#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const ROOT_DIR = process.cwd();

require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  process.exit(1);
}

const DB_PATH = path.join(ROOT_DIR, 'assets', 'data', 'oscar-movies.db');
const DISCOVER_PAGE_SIZE = 20;
const TARGET_MOVIE_COUNT = 100;
const PAGE_COUNT = Math.ceil(TARGET_MOVIE_COUNT / DISCOVER_PAGE_SIZE);
const REQUEST_DELAY_MS = 25;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getDirectorName(credits) {
  return (
    credits?.crew?.find((member) => member.job === 'Director')?.name ?? null
  );
}

function normalizeDepartment(castPerson) {
  const fromKnownFor = nullableText(castPerson.known_for_department);
  if (fromKnownFor) {
    return fromKnownFor;
  }

  return 'Acting';
}

function normalizeCrewDepartment(crewPerson) {
  return (
    nullableText(crewPerson.department) ??
    nullableText(crewPerson.job) ??
    'Crew'
  );
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} ${response.status}`);
  }

  return response.json();
}

async function discoverPopularMovies(page) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
    page: String(page),
    sort_by: 'popularity.desc',
  });

  return fetchJson(
    `https://api.themoviedb.org/3/discover/movie?${params.toString()}`,
    `TMDB discover page=${page}`,
  );
}

async function fetchMovieDetails(tmdbId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    append_to_response: 'credits',
    language: 'en-US',
  });

  return fetchJson(
    `https://api.themoviedb.org/3/movie/${tmdbId}?${params.toString()}`,
    `TMDB movie id=${tmdbId}`,
  );
}

function ensurePeopleColumns() {
  const existingColumns = db
    .prepare('PRAGMA table_info(people)')
    .all()
    .map((column) => column.name);

  const requiredColumns = [
    'tmdb_id INTEGER',
    'profile_path TEXT',
    'known_for_department TEXT',
    'wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0)',
    'nominations INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0)',
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
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_people_department_name_nocase ON people(known_for_department, name COLLATE NOCASE)',
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
    CREATE INDEX IF NOT EXISTS idx_movie_cast_person_castorder_movie
      ON movie_cast(person_id, cast_order, movie_id);
  `);
}

const findMovieByTmdbId = db.prepare(
  'SELECT id FROM movies WHERE tmdb_id = ? LIMIT 1',
);
const findMovieByImdbId = db.prepare(
  'SELECT id FROM movies WHERE imdb_id = ? LIMIT 1',
);
const findMovieByTitle = db.prepare(
  'SELECT id FROM movies WHERE title = ? LIMIT 1',
);

const insertMovie = db.prepare(`
  INSERT INTO movies (
    title,
    tmdb_id,
    imdb_id,
    backdrop_path,
    original_title,
    overview,
    poster_path,
    release_date,
    runtime,
    tagline,
    director
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateMovie = db.prepare(`
  UPDATE movies
  SET
    title = COALESCE(?, title),
    tmdb_id = COALESCE(tmdb_id, ?),
    imdb_id = COALESCE(?, imdb_id),
    backdrop_path = COALESCE(?, backdrop_path),
    original_title = COALESCE(?, original_title),
    overview = COALESCE(?, overview),
    poster_path = COALESCE(?, poster_path),
    release_date = COALESCE(?, release_date),
    runtime = COALESCE(?, runtime),
    tagline = COALESCE(?, tagline),
    director = COALESCE(?, director)
  WHERE id = ?
`);

const findPersonByTmdbId = db.prepare(
  'SELECT id FROM people WHERE tmdb_id = ? LIMIT 1',
);

const insertPerson = db.prepare(`
  INSERT OR IGNORE INTO people (
    name,
    tmdb_id,
    profile_path,
    known_for_department
  ) VALUES (?, ?, ?, ?)
`);

const updatePerson = db.prepare(`
  UPDATE people
  SET
    name = COALESCE(?, name),
    profile_path = COALESCE(?, profile_path),
    known_for_department = COALESCE(?, known_for_department)
  WHERE id = ?
`);

const deleteMovieCast = db.prepare('DELETE FROM movie_cast WHERE movie_id = ?');
const insertMovieCast = db.prepare(`
  INSERT OR REPLACE INTO movie_cast (
    movie_id,
    person_id,
    cast_order,
    character,
    department
  ) VALUES (?, ?, ?, ?, ?)
`);

function resolveExistingMovieId(detail, discoverMovie) {
  const tmdbId = nullableNumber(detail.id ?? discoverMovie.id);
  const imdbId = nullableText(detail.imdb_id);
  const title = nullableText(detail.title) ?? nullableText(discoverMovie.title);

  if (tmdbId != null) {
    const movie = findMovieByTmdbId.get(tmdbId);
    if (movie) {
      return movie.id;
    }
  }

  if (imdbId) {
    const movie = findMovieByImdbId.get(imdbId);
    if (movie) {
      return movie.id;
    }
  }

  if (title) {
    const movie = findMovieByTitle.get(title);
    if (movie) {
      return movie.id;
    }
  }

  return null;
}

function upsertMovieAndCast(detail, discoverMovie) {
  const tmdbId = nullableNumber(detail.id ?? discoverMovie.id);
  const movieTitle =
    nullableText(detail.title) ??
    nullableText(discoverMovie.title) ??
    'Untitled';
  const movieId = resolveExistingMovieId(detail, discoverMovie);
  const directorName = nullableText(getDirectorName(detail.credits));

  if (movieId == null) {
    const inserted = insertMovie.run(
      movieTitle,
      tmdbId,
      nullableText(detail.imdb_id),
      nullableText(detail.backdrop_path),
      nullableText(detail.original_title),
      nullableText(detail.overview),
      nullableText(detail.poster_path),
      nullableText(detail.release_date),
      nullableNumber(detail.runtime),
      nullableText(detail.tagline),
      directorName,
    );

    return Number(inserted.lastInsertRowid);
  }

  updateMovie.run(
    movieTitle,
    tmdbId,
    nullableText(detail.imdb_id),
    nullableText(detail.backdrop_path),
    nullableText(detail.original_title),
    nullableText(detail.overview),
    nullableText(detail.poster_path),
    nullableText(detail.release_date),
    nullableNumber(detail.runtime),
    nullableText(detail.tagline),
    directorName,
    movieId,
  );

  return movieId;
}

function upsertMovieCast(movieId, credits) {
  deleteMovieCast.run(movieId);

  const creditByTmdbPersonId = new Map();

  // Prefer cast entries where possible for character/order detail.
  for (const castPerson of credits.cast ?? []) {
    const tmdbPersonId = nullableNumber(castPerson.id);
    if (tmdbPersonId == null || creditByTmdbPersonId.has(tmdbPersonId)) {
      continue;
    }

    creditByTmdbPersonId.set(tmdbPersonId, {
      name: nullableText(castPerson.name) ?? 'Unknown Person',
      profilePath: nullableText(castPerson.profile_path),
      department: normalizeDepartment(castPerson),
      castOrder: nullableNumber(castPerson.order),
      character: nullableText(castPerson.character),
    });
  }

  for (const crewPerson of credits.crew ?? []) {
    const tmdbPersonId = nullableNumber(crewPerson.id);
    if (tmdbPersonId == null || creditByTmdbPersonId.has(tmdbPersonId)) {
      continue;
    }

    creditByTmdbPersonId.set(tmdbPersonId, {
      name: nullableText(crewPerson.name) ?? 'Unknown Person',
      profilePath: nullableText(crewPerson.profile_path),
      department: normalizeCrewDepartment(crewPerson),
      castOrder: null,
      character: null,
    });
  }

  for (const [tmdbPersonId, credit] of creditByTmdbPersonId.entries()) {
    if (tmdbPersonId == null) {
      continue;
    }

    let personId = findPersonByTmdbId.get(tmdbPersonId)?.id ?? null;
    if (personId == null) {
      insertPerson.run(
        credit.name,
        tmdbPersonId,
        credit.profilePath,
        credit.department,
      );
      personId = findPersonByTmdbId.get(tmdbPersonId)?.id ?? null;
    }

    if (personId == null) {
      continue;
    }

    updatePerson.run(
      credit.name,
      credit.profilePath,
      credit.department,
      personId,
    );

    insertMovieCast.run(
      movieId,
      personId,
      credit.castOrder,
      credit.character,
      credit.department,
    );
  }
}

const syncMovie = db.transaction((detail, discoverMovie) => {
  const movieId = upsertMovieAndCast(detail, discoverMovie);
  upsertMovieCast(movieId, detail.credits ?? {});
  return movieId;
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  ensurePeopleColumns();
  ensureMovieCastTable();

  console.log(
    `Syncing top ${TARGET_MOVIE_COUNT} TMDB popular movies across ${PAGE_COUNT} pages...`,
  );

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let castLinks = 0;

  for (let page = 1; page <= PAGE_COUNT; page++) {
    try {
      const discoverData = await discoverPopularMovies(page);
      const movies = (discoverData.results ?? []).slice(
        0,
        TARGET_MOVIE_COUNT - processed,
      );

      for (const discoverMovie of movies) {
        try {
          const detail = await fetchMovieDetails(discoverMovie.id);
          const existingMovieId = resolveExistingMovieId(detail, discoverMovie);
          syncMovie(detail, discoverMovie);

          if (existingMovieId == null) {
            inserted++;
          } else {
            updated++;
          }

          castLinks +=
            (detail.credits?.cast?.length ?? 0) +
            (detail.credits?.crew?.length ?? 0);
          processed++;

          if (processed % 20 === 0 || processed === TARGET_MOVIE_COUNT) {
            console.log(`  Synced ${processed}/${TARGET_MOVIE_COUNT} movies`);
          }

          await delay(REQUEST_DELAY_MS);
        } catch (error) {
          failed++;
          console.warn(
            `  FAILED movie tmdb_id=${discoverMovie.id}: ${error.message}`,
          );
        }
      }

      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      failed++;
      console.warn(`FAILED discover page=${page}: ${error.message}`);
    }
  }

  console.log('Done.');
  console.log(`  Movies synced: ${processed}`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Cast links refreshed: ${castLinks}`);
  console.log(`  Failed: ${failed}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
