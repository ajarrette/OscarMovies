#!/usr/bin/env node
/* eslint-env node */
'use strict';

/**
 * purge-movies.js
 *
 * Removes movies listed in assets/data/movie-purge-blacklist.json from the
 * database. All tables that reference movies.id have ON DELETE CASCADE foreign
 * keys, so child rows (movie_cast, movie_tmdb_genres,
 * movie_tmdb_production_companies, movie_tmdb_spoken_languages,
 * nomination_movies) are removed automatically.
 *
 * Safety rule: a blacklisted movie is PROTECTED and will NOT be deleted if it
 * has any Oscar nomination links (exists in nomination_movies) or if its
 * wins / nominations columns are greater than 0.
 *
 * Default mode is dry-run (no writes). Pass --apply to perform deletes.
 * A JSON report is written to assets/data/reports/ on every run.
 *
 * Usage:
 *   node ./assets/data/local/purge-movies.js           (dry-run)
 *   node ./assets/data/local/purge-movies.js --apply   (delete purgeable movies)
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'oscar-movies.db');
const DEFAULT_BLACKLIST_PATH = path.join(
  DATA_DIR,
  'movie-purge-blacklist.json',
);
const DEFAULT_REPORT_DIR = path.join(DATA_DIR, 'reports');

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dbPath: DEFAULT_DB_PATH,
    blacklistPath: DEFAULT_BLACKLIST_PATH,
    reportDir: DEFAULT_REPORT_DIR,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--apply') {
      args.apply = true;
      continue;
    }

    if (arg === '--db') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --db');
      args.dbPath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--blacklist') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --blacklist');
      args.blacklistPath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--report-dir') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --report-dir');
      args.reportDir = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

// ── Blacklist loading ─────────────────────────────────────────────────────────

function loadBlacklist(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blacklist file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed?.movies) ? parsed.movies : [];

  const entries = [];
  for (const row of rows) {
    const tmdbId = typeof row?.tmdbId === 'number' ? row.tmdbId : null;
    if (tmdbId == null) {
      console.warn(
        `Skipping blacklist entry with no tmdbId: ${JSON.stringify(row)}`,
      );
      continue;
    }
    entries.push({
      tmdbId,
      title: row.title ?? null,
      reason: row.reason ?? null,
    });
  }

  return entries;
}

// ── Movie classification ──────────────────────────────────────────────────────

/**
 * Dynamically discovers all tables that have a foreign key referencing
 * movies.id so we can report how many rows will cascade.
 */
function discoverMovieReferenceTables(db) {
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_schema
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'movies'
       ORDER BY name ASC`,
    )
    .all();

  const refs = [];

  for (const { name } of tables) {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    const movieFk = foreignKeys.find(
      (fk) => fk.table === 'movies' && fk.to === 'id',
    );
    if (!movieFk) continue;

    refs.push({ table: name, column: movieFk.from });
  }

  return refs;
}

function countChildRows(db, refTables, movieId) {
  const counts = {};
  for (const { table, column } of refTables) {
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE "${column}" = ?`)
      .get(movieId);
    counts[table] = row?.n ?? 0;
  }
  return counts;
}

function classifyMovies(db, blacklistEntries, refTables) {
  const isNominationLinked = db.prepare(
    'SELECT 1 FROM nomination_movies WHERE movie_id = ? LIMIT 1',
  );
  const findByTmdbId = db.prepare(
    'SELECT id, title, tmdb_id, wins, nominations FROM movies WHERE tmdb_id = ? LIMIT 1',
  );

  const purgeable = [];
  const protected_ = [];
  const notFound = [];

  for (const entry of blacklistEntries) {
    const row = findByTmdbId.get(entry.tmdbId);

    if (row == null) {
      notFound.push({ ...entry, dbId: null });
      continue;
    }

    const hasNominationLink = isNominationLinked.get(row.id) != null;
    const hasOscarCredits = (row.wins ?? 0) > 0 || (row.nominations ?? 0) > 0;

    if (hasNominationLink || hasOscarCredits) {
      protected_.push({
        ...entry,
        dbId: row.id,
        dbTitle: row.title,
        wins: row.wins ?? 0,
        nominations: row.nominations ?? 0,
        hasNominationLink,
        childRows: countChildRows(db, refTables, row.id),
        reason_protected: hasNominationLink
          ? 'has Oscar nomination link'
          : 'has wins/nominations > 0',
      });
    } else {
      purgeable.push({
        ...entry,
        dbId: row.id,
        dbTitle: row.title,
        wins: row.wins ?? 0,
        nominations: row.nominations ?? 0,
        childRows: countChildRows(db, refTables, row.id),
      });
    }
  }

  return { purgeable, protected: protected_, notFound };
}

// ── Report writing ────────────────────────────────────────────────────────────

function writeReport(reportDir, report) {
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
  const filename = `purge-movies-${ts}.json`;
  const filePath = path.join(reportDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.dbPath)) {
    console.error(`DB not found: ${args.dbPath}`);
    process.exit(1);
  }

  console.log(args.apply ? '[APPLY MODE]' : '[DRY-RUN MODE]');
  console.log(`Loading blacklist from: ${args.blacklistPath}`);

  const blacklistEntries = loadBlacklist(args.blacklistPath);
  console.log(`Blacklist entries: ${blacklistEntries.length}`);

  const db = new Database(args.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const refTables = discoverMovieReferenceTables(db);
  console.log(
    `Discovered ${refTables.length} table(s) referencing movies: ${refTables.map((r) => r.table).join(', ')}`,
  );

  const {
    purgeable,
    protected: protectedMovies,
    notFound,
  } = classifyMovies(db, blacklistEntries, refTables);

  console.log(`\nClassification:`);
  console.log(`  Purgeable  : ${purgeable.length}`);
  console.log(`  Protected  : ${protectedMovies.length}`);
  console.log(`  Not in DB  : ${notFound.length}`);

  let deletedCount = 0;
  let totalChildRowsDeleted = 0;

  if (args.apply) {
    if (purgeable.length === 0) {
      console.log('\nNo purgeable movies to delete.');
    } else {
      const deleteMovie = db.prepare('DELETE FROM movies WHERE id = ?');

      const applyDeletions = db.transaction(() => {
        for (const movie of purgeable) {
          const result = deleteMovie.run(movie.dbId);
          if (result.changes > 0) {
            deletedCount += 1;
            const childTotal = Object.values(movie.childRows).reduce(
              (sum, n) => sum + n,
              0,
            );
            totalChildRowsDeleted += childTotal;
          }
        }
      });

      applyDeletions();
      console.log(`\nPurged ${deletedCount} movie(s):`);
      for (const m of purgeable) {
        console.log(`  - ${m.dbTitle ?? m.title} (tmdb_id=${m.tmdbId})`);
      }
      console.log(
        `\nCascaded deletions in child tables: ${totalChildRowsDeleted} row(s).`,
      );
    }
  } else {
    if (purgeable.length > 0) {
      console.log('\nPurgeable movies (would be deleted with --apply):');
      for (const m of purgeable) {
        const childSummary = Object.entries(m.childRows)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `${t}=${n}`)
          .join(', ');
        console.log(
          `  [${m.dbId}] ${m.dbTitle ?? m.title} (tmdb_id=${m.tmdbId})${childSummary ? ` → cascade: ${childSummary}` : ''}`,
        );
      }
    }

    if (protectedMovies.length > 0) {
      console.log('\nProtected movies (will NOT be deleted):');
      for (const m of protectedMovies) {
        console.log(
          `  [${m.dbId}] ${m.dbTitle ?? m.title} (tmdb_id=${m.tmdbId}) — ${m.reason_protected}`,
        );
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    blacklistPath: args.blacklistPath,
    blacklistEntries: blacklistEntries.length,
    purgeable: purgeable.length,
    protected: protectedMovies.length,
    notFound: notFound.length,
    deletedMovies: args.apply ? deletedCount : 0,
    totalChildRowsDeleted: args.apply ? totalChildRowsDeleted : 0,
    details: {
      purgeable,
      protected: protectedMovies,
      notFound,
    },
  };

  const reportPath = writeReport(args.reportDir, report);
  console.log(`\nReport written: ${reportPath}`);

  db.close();
}

run();
