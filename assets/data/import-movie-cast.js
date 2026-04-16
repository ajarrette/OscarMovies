#!/usr/bin/env node
'use strict';

const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  process.exit(1);
}

const DB_PATH = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'data',
  'oscar-movies.db',
);
const REQUEST_DELAY_MS = 25;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function ensurePeopleColumns() {
  const existingColumns = db
    .prepare('PRAGMA table_info(people)')
    .all()
    .map((column) => column.name);

  const requiredColumns = [
    'tmdb_id INTEGER',
    'popularity REAL',
    'profile_path TEXT',
    'known_for_department TEXT',
  ];

  for (const columnDef of requiredColumns) {
    const columnName = columnDef.trim().split(/\s+/)[0];
    if (!existingColumns.includes(columnName)) {
      db.prepare(`ALTER TABLE people ADD COLUMN ${columnDef}`).run();
      console.log(`Added column: people.${columnName}`);
    }
  }

  db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_people_tmdb_id ON people(tmdb_id)',
  ).run();
}

function ensureMovieCastTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS movie_cast (
      movie_id    INTEGER NOT NULL,
      person_id   INTEGER NOT NULL,
      cast_order  INTEGER,
      character   TEXT,
      department  TEXT,
      PRIMARY KEY (movie_id, person_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_movie_cast_movie ON movie_cast(movie_id);
    CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);
  `);
}

const findPersonByTmdbId = db.prepare(
  'SELECT id FROM people WHERE tmdb_id = ? LIMIT 1',
);

const insertPerson = db.prepare(`
  INSERT OR IGNORE INTO people (
    name,
    tmdb_id,
    popularity,
    profile_path,
    known_for_department
  ) VALUES (?, ?, ?, ?, ?)
`);

const updatePerson = db.prepare(`
  UPDATE people
  SET
    name = COALESCE(?, name),
    popularity = COALESCE(?, popularity),
    profile_path = COALESCE(?, profile_path),
    known_for_department = COALESCE(?, known_for_department)
  WHERE id = ?
`);

async function fetchMovieCredits(tmdbId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
  });

  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/credits?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB credits ${res.status} for movie id ${tmdbId}`);
  }

  return res.json();
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeDepartment(castPerson) {
  const fromKnownFor = nullableText(castPerson.known_for_department);
  if (fromKnownFor) return fromKnownFor;

  // Cast entries are acting by definition.
  return 'Acting';
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  ensurePeopleColumns();
  ensureMovieCastTable();

  const insertMovieCast = db.prepare(`
    INSERT OR REPLACE INTO movie_cast (
      movie_id,
      person_id,
      cast_order,
      character,
      department
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const selectMoviesWithoutCast = db.prepare(`
    SELECT m.id, m.tmdb_id
    FROM movies m
    WHERE m.tmdb_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM movie_cast mc
        WHERE mc.movie_id = m.id
      )
    ORDER BY m.id ASC
  `);

  const movies = selectMoviesWithoutCast.all();
  console.log(`Importing cast for ${movies.length} movies...`);

  let processed = 0;
  let linked = 0;
  let failed = 0;

  const tx = db.transaction((movieId, cast) => {
    for (const castPerson of cast) {
      const tmdbPersonId = nullableNumber(castPerson.id);
      if (tmdbPersonId == null) {
        continue;
      }

      let personId = findPersonByTmdbId.get(tmdbPersonId)?.id ?? null;
      if (personId == null) {
        insertPerson.run(
          nullableText(castPerson.name) ?? 'Unknown Person',
          tmdbPersonId,
          nullableNumber(castPerson.popularity),
          nullableText(castPerson.profile_path),
          normalizeDepartment(castPerson),
        );
        personId = findPersonByTmdbId.get(tmdbPersonId)?.id ?? null;
      }

      if (personId == null) {
        continue;
      }

      updatePerson.run(
        nullableText(castPerson.name),
        nullableNumber(castPerson.popularity),
        nullableText(castPerson.profile_path),
        normalizeDepartment(castPerson),
        personId,
      );

      insertMovieCast.run(
        movieId,
        personId,
        nullableNumber(castPerson.order),
        nullableText(castPerson.character),
        normalizeDepartment(castPerson),
      );

      linked++;
    }
  });

  for (const movie of movies) {
    try {
      const credits = await fetchMovieCredits(movie.tmdb_id);
      tx(movie.id, credits.cast ?? []);
      processed++;

      if (processed % 50 === 0 || processed === movies.length) {
        console.log(`  Processed ${processed}/${movies.length}`);
      }

      await delay(REQUEST_DELAY_MS);
    } catch (err) {
      failed++;
      console.warn(`  FAILED movie tmdb_id=${movie.tmdb_id}: ${err.message}`);
    }
  }

  console.log('Done.');
  console.log(`  Movies processed: ${processed}`);
  console.log(`  Cast links upserted: ${linked}`);
  console.log(`  Failed movies: ${failed}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
