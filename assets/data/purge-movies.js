#!/usr/bin/env node
/* eslint-env node */
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(__dirname, 'oscar-movies.db');
const DEFAULT_BLACKLIST_PATH = path.join(
  __dirname,
  'movie-purge-blacklist.json',
);
const DEFAULT_REPORT_DIR = path.join(__dirname, 'reports');

function parseArgs(argv) {
  const args = {
    dbPath: DEFAULT_DB_PATH,
    blacklistFile: DEFAULT_BLACKLIST_PATH,
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
      if (!next) {
        throw new Error('Missing value for --db');
      }

      args.dbPath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--blacklist-file') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --blacklist-file');
      }

      args.blacklistFile = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--report-dir') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --report-dir');
      }

      args.reportDir = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampForFilename(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function loadBlacklist(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blacklist file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const rawMovies = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.movies)
      ? parsed.movies
      : null;

  if (rawMovies == null) {
    throw new Error(
      'Blacklist file must be a JSON array or an object with a movies array',
    );
  }

  const movies = [];
  const seenTmdbIds = new Set();

  for (const [index, entry] of rawMovies.entries()) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(
        `Blacklist entry at index ${index} must be an object with tmdbId`,
      );
    }

    const tmdbId = Number.parseInt(String(entry.tmdbId), 10);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      throw new Error(
        `Blacklist entry at index ${index} has invalid tmdbId: ${entry.tmdbId}`,
      );
    }

    if (seenTmdbIds.has(tmdbId)) {
      continue;
    }

    seenTmdbIds.add(tmdbId);
    movies.push({
      tmdbId,
      title:
        typeof entry.title === 'string' ? entry.title.trim() || null : null,
      reason:
        typeof entry.reason === 'string' ? entry.reason.trim() || null : null,
    });
  }

  return movies;
}

function buildMovieLookupMap(movies) {
  return new Map(movies.map((movie) => [movie.tmdbId, movie]));
}

function selectBlacklistedMovies(db, tmdbIds) {
  if (tmdbIds.length === 0) {
    return [];
  }

  const placeholders = tmdbIds.map(() => '?').join(', ');

  return db
    .prepare(
      `
      SELECT
        m.id,
        m.tmdb_id AS tmdbId,
        m.title,
        m.release_date AS releaseDate,
        m.popularity,
        COALESCE(m.wins, 0) AS wins,
        COALESCE(m.nominations, 0) AS nominations,
        EXISTS(
          SELECT 1
          FROM nomination_movies nm
          WHERE nm.movie_id = m.id
        ) AS hasNominationLink
      FROM movies m
      WHERE m.tmdb_id IN (${placeholders})
      ORDER BY m.title COLLATE NOCASE ASC, m.id ASC
    `,
    )
    .all(...tmdbIds);
}

function classifyMatches(matches, blacklistByTmdbId) {
  const purgeable = [];
  const protectedMovies = [];

  for (const match of matches) {
    const source = blacklistByTmdbId.get(match.tmdbId) ?? null;
    const isAwarded =
      Boolean(match.hasNominationLink) ||
      match.wins > 0 ||
      match.nominations > 0;

    const row = {
      id: match.id,
      tmdbId: match.tmdbId,
      title: match.title,
      releaseDate: match.releaseDate,
      popularity: match.popularity,
      wins: match.wins,
      nominations: match.nominations,
      hasNominationLink: Boolean(match.hasNominationLink),
      blacklistTitle: source?.title ?? null,
      reason: source?.reason ?? null,
    };

    if (isAwarded) {
      protectedMovies.push(row);
    } else {
      purgeable.push(row);
    }
  }

  return { purgeable, protectedMovies };
}

function buildMissingEntries(blacklistMovies, foundMatchesByTmdbId) {
  return blacklistMovies
    .filter((movie) => !foundMatchesByTmdbId.has(movie.tmdbId))
    .map((movie) => ({
      tmdbId: movie.tmdbId,
      title: movie.title,
      reason: movie.reason,
    }));
}

function writeReport(reportDir, payload) {
  ensureDirectory(reportDir);

  const filePath = path.join(
    reportDir,
    `movie-purge-report-${timestampForFilename(new Date())}.json`,
  );

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return filePath;
}

function printMovieList(header, movies) {
  console.log(header);

  if (movies.length === 0) {
    console.log('  (none)');
    return;
  }

  for (const movie of movies) {
    const parts = [`tmdb_id=${movie.tmdbId}`, `title=${movie.title}`];

    if (movie.releaseDate) {
      parts.push(`release_date=${movie.releaseDate}`);
    }

    if (movie.reason) {
      parts.push(`reason=${movie.reason}`);
    }

    if (movie.hasNominationLink || movie.nominations > 0 || movie.wins > 0) {
      parts.push(
        `protected_by_awards=${movie.hasNominationLink || movie.nominations > 0 || movie.wins > 0}`,
      );
      parts.push(`nominations=${movie.nominations}`);
      parts.push(`wins=${movie.wins}`);
    }

    console.log(`  - ${parts.join(', ')}`);
  }
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const blacklistMovies = loadBlacklist(options.blacklistFile);
  const blacklistByTmdbId = buildMovieLookupMap(blacklistMovies);
  const db = new Database(options.dbPath);

  db.pragma('foreign_keys = ON');

  try {
    const sizeBefore =
      db.pragma('page_count', { simple: true }) *
      db.pragma('page_size', { simple: true });

    const tmdbIds = blacklistMovies.map((movie) => movie.tmdbId);
    const matches = selectBlacklistedMovies(db, tmdbIds);
    const foundMatchesByTmdbId = new Set(matches.map((movie) => movie.tmdbId));
    const { purgeable, protectedMovies } = classifyMatches(
      matches,
      blacklistByTmdbId,
    );
    const missing = buildMissingEntries(blacklistMovies, foundMatchesByTmdbId);

    const report = {
      generatedAt: new Date().toISOString(),
      mode: options.apply ? 'apply' : 'dry-run',
      dbPath: options.dbPath,
      blacklistFile: options.blacklistFile,
      summary: {
        blacklistEntries: blacklistMovies.length,
        matchedMovies: matches.length,
        purgeableMovies: purgeable.length,
        protectedMovies: protectedMovies.length,
        missingMovies: missing.length,
      },
      purgeableMovies: purgeable,
      protectedMovies,
      missingBlacklistEntries: missing,
    };

    const reportPath = writeReport(options.reportDir, report);

    console.log(`DB: ${options.dbPath}`);
    console.log(`Blacklist: ${options.blacklistFile}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Blacklist entries: ${blacklistMovies.length}`);
    console.log(`Matched movies: ${matches.length}`);
    console.log(`Will purge: ${purgeable.length}`);
    console.log(`Protected by awards: ${protectedMovies.length}`);
    console.log(`Missing from DB: ${missing.length}`);

    printMovieList('Purge candidates:', purgeable);
    printMovieList('Protected blacklist matches:', protectedMovies);
    printMovieList('Missing blacklist entries:', missing);

    if (!options.apply) {
      console.log('Dry run only; no rows deleted.');
      return;
    }

    const deleteMovie = db.prepare(
      `
      DELETE FROM movies
      WHERE tmdb_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM nomination_movies nm
          WHERE nm.movie_id = movies.id
        )
        AND COALESCE(nominations, 0) = 0
        AND COALESCE(wins, 0) = 0
    `,
    );

    const applyDelete = db.transaction((moviesToDelete) => {
      let deletedRows = 0;

      for (const movie of moviesToDelete) {
        deletedRows += deleteMovie.run(movie.tmdbId).changes;
      }

      return deletedRows;
    });

    const deletedRows = applyDelete(purgeable);
    db.exec('VACUUM');

    const sizeAfter =
      db.pragma('page_count', { simple: true }) *
      db.pragma('page_size', { simple: true });

    console.log(`Deleted rows: ${deletedRows}`);
    console.log(
      `Size before: ${sizeBefore} bytes (${(sizeBefore / 1024 / 1024).toFixed(2)} MB)`,
    );
    console.log(
      `Size after: ${sizeAfter} bytes (${(sizeAfter / 1024 / 1024).toFixed(2)} MB)`,
    );
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
