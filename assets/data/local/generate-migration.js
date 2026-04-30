#!/usr/bin/env node
/* eslint-env node */
'use strict';

/**
 * generate-migration.js
 *
 * Generates a SQL migration file capturing every row that changed between
 * the last two entries in sys_version_history.
 *
 * Output location: assets/data/local/migrations/
 * File naming:     migration_{prevVersion}_to_{currentVersion}.sql
 *                  (version strings are sanitized for safe filenames)
 *
 * Only tables that have a last_modified column are scanned.
 * The generated file is organised in per-table sections and uses
 * INSERT OR REPLACE so each statement is safe to re-run (idempotent).
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const ROOT = path.resolve(process.cwd());
const DB_PATH = path.join(ROOT, 'assets', 'data', 'oscar-movies.db');
const MIGRATIONS_DIR = path.join(ROOT, 'assets', 'data', 'local', 'migrations');

// All tables that carry a last_modified column and should appear in migrations.
// Order matters: parent tables come before child tables so FK constraints are
// satisfied when the migration is replayed top-to-bottom.
const TRACKED_TABLES = [
  'ceremonies',
  'categories',
  'movies',
  'people',
  'nominations',
  'nomination_movies',
  'nomination_people',
  'nomination_nominees',
  'tmdb_genres',
  'movie_tmdb_genres',
  'tmdb_production_companies',
  'movie_tmdb_production_companies',
  'tmdb_spoken_languages',
  'movie_tmdb_spoken_languages',
  'movie_cast',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sanitize a version string so it is safe to use in a filename.
 * Replaces any character that is not alphanumeric, '.', or '-' with '_'.
 */
function sanitizeVersion(version) {
  return String(version).replace(/[^a-zA-Z0-9.\-]/g, '_');
}

/**
 * Parse a last_modified value into a Date, handling both ISO strings
 * (datetime('now') format) and Unix-millisecond integers stored as TEXT
 * (strftime('%s','now') * 1000 format).
 */
function parseTimestamp(val) {
  if (val == null) return null;

  const asNum = Number(val);
  if (!Number.isNaN(asNum)) {
    // Heuristic: values > 1e12 are milliseconds, > 1e9 are seconds.
    if (asNum > 1e12) return new Date(asNum);
    if (asNum > 1e9) return new Date(asNum * 1000);
  }

  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a JavaScript value as a SQL literal.
 */
function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Build a single INSERT OR REPLACE statement for one row.
 */
function buildInsertOrReplace(tableName, columns, row) {
  const cols = columns.map((c) => c.name).join(', ');
  const vals = columns.map((c) => sqlLiteral(row[c.name])).join(', ');
  return `INSERT OR REPLACE INTO ${tableName} (${cols}) VALUES (${vals});`;
}

/**
 * Returns true if the given table exists in the DB.
 */
function tableExists(db, tableName) {
  const row = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName);
  return row != null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');

  // ── 1. Read last two version entries ───────────────────────────────────────
  if (!tableExists(db, 'sys_version_history')) {
    console.error('sys_version_history table does not exist in the DB.');
    process.exit(1);
  }

  const versionRows = db
    .prepare('SELECT * FROM sys_version_history ORDER BY id DESC LIMIT 2')
    .all();

  if (versionRows.length === 0) {
    console.error('sys_version_history is empty — nothing to migrate.');
    process.exit(1);
  }

  const currentEntry = versionRows[0];
  const prevEntry = versionRows.length >= 2 ? versionRows[1] : null;

  const currentVersion = currentEntry.version;
  const prevVersion = prevEntry ? prevEntry.version : 'initial';

  const currentTimestamp = parseTimestamp(currentEntry.modified_on);
  // If no previous entry, include all rows (use epoch 0 as lower bound).
  const prevTimestamp = prevEntry
    ? parseTimestamp(prevEntry.modified_on)
    : new Date(0);

  if (currentTimestamp == null) {
    console.error(
      `Cannot parse current version timestamp: ${currentEntry.modified_on}`,
    );
    process.exit(1);
  }

  console.log(
    `Current version : ${currentVersion} (${currentEntry.modified_on})`,
  );
  console.log(
    `Previous version: ${prevVersion}${prevEntry ? ` (${prevEntry.modified_on})` : ' (none — capturing all rows)'}`,
  );

  // ── 2. Determine output file path ──────────────────────────────────────────
  const safeFrom = sanitizeVersion(prevVersion);
  const safeTo = sanitizeVersion(currentVersion);
  const fileName = `migration_${safeFrom}_to_${safeTo}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, fileName);

  if (fs.existsSync(filePath)) {
    console.log(`Migration file already exists — skipping: ${fileName}`);
    process.exit(0);
  }

  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });

  // ── 3. Scan each tracked table for changed rows ────────────────────────────
  const sections = [];
  let totalChangedRows = 0;

  for (const tableName of TRACKED_TABLES) {
    if (!tableExists(db, tableName)) {
      console.warn(`  SKIP (table not found): ${tableName}`);
      continue;
    }

    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const hasLastModified = columns.some((c) => c.name === 'last_modified');

    if (!hasLastModified) {
      continue;
    }

    // Load all rows then filter in JS to handle mixed timestamp formats.
    const allRows = db.prepare(`SELECT * FROM ${tableName}`).all();

    const changedRows = allRows.filter((row) => {
      const ts = parseTimestamp(row.last_modified);
      if (ts == null) return false;
      // Row was modified after the previous version snapshot and on or before
      // the current version snapshot.
      return ts > prevTimestamp && ts <= currentTimestamp;
    });

    if (changedRows.length === 0) {
      continue;
    }

    totalChangedRows += changedRows.length;

    const separator = '='.repeat(60);
    const lines = [
      `-- ${separator}`,
      `-- TABLE: ${tableName}  (${changedRows.length} row${changedRows.length !== 1 ? 's' : ''} changed)`,
      `-- ${separator}`,
      '',
    ];

    for (const row of changedRows) {
      lines.push(buildInsertOrReplace(tableName, columns, row));
    }

    sections.push(lines.join('\n'));
    console.log(`  ${tableName}: ${changedRows.length} changed row(s)`);
  }

  db.close();

  // ── 4. Write the migration file ────────────────────────────────────────────
  if (sections.length === 0) {
    console.log(
      'No changed rows found between the two versions — no migration file created.',
    );
    process.exit(0);
  }

  const header = [
    `-- Migration: ${prevVersion}  →  ${currentVersion}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- From snapshot: ${prevEntry ? prevEntry.modified_on : 'epoch'}`,
    `-- To snapshot:   ${currentEntry.modified_on}`,
    `-- Total changed rows: ${totalChangedRows}`,
    `--`,
    `-- Each statement is INSERT OR REPLACE so this file is safe to re-run.`,
    `-- Tables are ordered to satisfy foreign key constraints.`,
    '',
    '',
  ].join('\n');

  const body = sections.join('\n\n') + '\n';
  fs.writeFileSync(filePath, header + body, 'utf8');

  console.log('');
  console.log(
    `Migration file written: assets/data/local/migrations/${fileName}`,
  );
  console.log(`Total changed rows captured: ${totalChangedRows}`);
}

run();
