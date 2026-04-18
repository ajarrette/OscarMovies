#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'data',
  'oscar-movies.db',
);
const DEFAULT_MIN_POPULARITY = 2;

function parseArgs(argv) {
  const args = {
    dbPath: DEFAULT_DB_PATH,
    minPopularity: DEFAULT_MIN_POPULARITY,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--db') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --db');
      }
      args.dbPath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--min-popularity') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --min-popularity');
      }

      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('--min-popularity must be a non-negative number');
      }

      args.minPopularity = parsed;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const db = new Database(options.dbPath);

  db.pragma('foreign_keys = ON');

  try {
    const sizeBefore =
      db.pragma('page_count', { simple: true }) *
      db.pragma('page_size', { simple: true });

    const totalPeople = db.prepare('SELECT COUNT(*) AS n FROM people').get().n;

    const candidateCount = db
      .prepare(
        `
        SELECT COUNT(*) AS n
        FROM people p
        WHERE (p.popularity IS NULL OR p.popularity < ?)
          AND p.profile_path IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM nomination_people np
            WHERE np.person_id = p.id
          )
      `,
      )
      .get(options.minPopularity).n;

    console.log(`DB: ${options.dbPath}`);
    console.log(`Total people: ${totalPeople}`);
    console.log(`Delete candidates: ${candidateCount}`);
    console.log(
      `Rule: popularity IS NULL OR popularity < ${options.minPopularity}, profile_path IS NULL, and not in nomination_people`,
    );

    if (options.dryRun) {
      console.log('Dry run enabled; no rows deleted.');
      return;
    }

    const deleteRows = db.prepare(
      `
      DELETE FROM people
      WHERE (popularity IS NULL OR popularity < ?)
        AND profile_path IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM nomination_people np
          WHERE np.person_id = people.id
        )
    `,
    );

    const tx = db.transaction((minPopularity) => deleteRows.run(minPopularity));
    const deleteResult = tx(options.minPopularity);

    const remainingPeople = db
      .prepare('SELECT COUNT(*) AS n FROM people')
      .get().n;

    db.exec('VACUUM');

    const sizeAfter =
      db.pragma('page_count', { simple: true }) *
      db.pragma('page_size', { simple: true });

    console.log(`Deleted rows: ${deleteResult.changes}`);
    console.log(`Remaining people: ${remainingPeople}`);
    console.log(
      `Size before: ${sizeBefore} bytes (${(sizeBefore / 1024 / 1024).toFixed(2)} MB)`,
    );
    console.log(
      `Size after: ${sizeAfter} bytes (${(sizeAfter / 1024 / 1024).toFixed(2)} MB)`,
    );

    const orphanRows = db
      .prepare(
        `
        SELECT COUNT(*) AS n
        FROM nomination_people np
        LEFT JOIN people p ON p.id = np.person_id
        WHERE p.id IS NULL
      `,
      )
      .get().n;

    console.log(`Orphan nomination_people rows: ${orphanRows}`);
  } finally {
    db.close();
  }
}

try {
  run();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
