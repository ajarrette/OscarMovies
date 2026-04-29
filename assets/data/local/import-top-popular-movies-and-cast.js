#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(process.cwd());
require('dotenv').config({ path: path.join(ROOT, '.env') });

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  process.exit(1);
}

const DB_PATH = path.join(ROOT, 'assets', 'data', 'oscar-movies.db');
const REQUEST_DELAY_MS = 30;
const TARGET_COUNT = 100;

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
    'imdb_id TEXT',
    'biography TEXT',
    'birthday TEXT',
    'deathday TEXT',
    'gender INTEGER',
    'known_for_department TEXT',
    'place_of_birth TEXT',
    'profile_path TEXT',
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
}

function ensureMovieCastTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS movie_cast (
      movie_id      INTEGER NOT NULL,
      person_id     INTEGER NOT NULL,
      cast_order    INTEGER,
      character     TEXT,
      department    TEXT,
      last_modified TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (movie_id, person_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_movie_cast_movie ON movie_cast(movie_id);
    CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);
  `);
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${label} ${res.status}${body ? ` ${body}` : ''}`);
  }
  return res.json();
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

  const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
  return fetchJson(url, `TMDB discover/movie page=${page}`);
}

async function fetchMovieDetailsWithCredits(tmdbMovieId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    append_to_response: 'credits',
  });

  const url = `https://api.themoviedb.org/3/movie/${tmdbMovieId}?${params.toString()}`;
  return fetchJson(url, `TMDB movie details id=${tmdbMovieId}`);
}

async function fetchPersonDetails(tmdbPersonId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
  });

  const url = `https://api.themoviedb.org/3/person/${tmdbPersonId}?${params.toString()}`;
  return fetchJson(url, `TMDB person details id=${tmdbPersonId}`);
}

async function collectTopPopularMovies(targetCount) {
  const rows = [];
  const seen = new Set();
  let page = 1;

  while (rows.length < targetCount) {
    const data = await discoverPopularMovies(page);
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0) {
      break;
    }

    for (const movie of results) {
      const tmdbId = nullableNumber(movie?.id);
      if (tmdbId == null || seen.has(tmdbId)) {
        continue;
      }

      seen.add(tmdbId);
      rows.push(movie);

      if (rows.length >= targetCount) {
        break;
      }
    }

    console.log(`Fetched discover page ${page}; ${rows.length}/${targetCount}`);
    page += 1;
    await delay(REQUEST_DELAY_MS);
  }

  if (rows.length < targetCount) {
    throw new Error(
      `Could only collect ${rows.length} movies from TMDB (target ${targetCount})`,
    );
  }

  return rows;
}

const findMovieByTmdbId = db.prepare(
  'SELECT id FROM movies WHERE tmdb_id = ? LIMIT 1',
);

const insertMovie = db.prepare(`
  INSERT INTO movies (
    title,
    tmdb_id,
    backdrop_path,
    original_title,
    overview,
    poster_path,
    release_date,
    runtime,
    tagline,
    last_modified
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (datetime('now')))
`);

const updateMovieById = db.prepare(`
  UPDATE movies
  SET
    title = ?,
    backdrop_path = ?,
    original_title = ?,
    overview = ?,
    poster_path = ?,
    release_date = ?,
    runtime = ?,
    tagline = ?,
    last_modified = (datetime('now'))
  WHERE id = ?
    AND (
      title IS NOT ?
      OR backdrop_path IS NOT ?
      OR original_title IS NOT ?
      OR overview IS NOT ?
      OR poster_path IS NOT ?
      OR release_date IS NOT ?
      OR runtime IS NOT ?
      OR tagline IS NOT ?
    )
`);

const findPersonByTmdbId = db.prepare(
  'SELECT id FROM people WHERE tmdb_id = ? LIMIT 1',
);
const findPersonByName = db.prepare(
  'SELECT id FROM people WHERE name = ? LIMIT 1',
);

const insertPerson = db.prepare(`
  INSERT OR IGNORE INTO people (
    name,
    tmdb_id,
    imdb_id,
    biography,
    birthday,
    deathday,
    gender,
    known_for_department,
    place_of_birth,
    profile_path,
    last_modified
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (datetime('now')))
`);

const updatePersonById = db.prepare(`
  UPDATE people
  SET
    tmdb_id = COALESCE(tmdb_id, ?1),
    imdb_id = COALESCE(imdb_id, ?2),
    biography = COALESCE(biography, ?3),
    birthday = COALESCE(birthday, ?4),
    deathday = COALESCE(deathday, ?5),
    gender = COALESCE(gender, ?6),
    known_for_department = COALESCE(known_for_department, ?7),
    place_of_birth = COALESCE(place_of_birth, ?8),
    profile_path = COALESCE(profile_path, ?9),
    last_modified = (datetime('now'))
  WHERE id = ?10
    AND (
      COALESCE(tmdb_id, ?1) IS NOT tmdb_id
      OR COALESCE(imdb_id, ?2) IS NOT imdb_id
      OR COALESCE(biography, ?3) IS NOT biography
      OR COALESCE(birthday, ?4) IS NOT birthday
      OR COALESCE(deathday, ?5) IS NOT deathday
      OR COALESCE(gender, ?6) IS NOT gender
      OR COALESCE(known_for_department, ?7) IS NOT known_for_department
      OR COALESCE(place_of_birth, ?8) IS NOT place_of_birth
      OR COALESCE(profile_path, ?9) IS NOT profile_path
    )
`);

const upsertMovieCast = db.prepare(`
  INSERT INTO movie_cast (
    movie_id,
    person_id,
    cast_order,
    character,
    department,
    last_modified
  ) VALUES (?, ?, ?, ?, ?, (datetime('now')))
  ON CONFLICT(movie_id, person_id) DO UPDATE SET
    cast_order = excluded.cast_order,
    character = excluded.character,
    department = excluded.department,
    last_modified = (datetime('now'))
  WHERE movie_cast.cast_order IS NOT excluded.cast_order
    OR movie_cast.character IS NOT excluded.character
    OR movie_cast.department IS NOT excluded.department
`);

const personIdCache = new Map();

async function ensurePersonId(castEntry) {
  const tmdbPersonId = nullableNumber(castEntry?.id);
  if (tmdbPersonId == null) {
    return null;
  }

  if (personIdCache.has(tmdbPersonId)) {
    return personIdCache.get(tmdbPersonId);
  }

  const byTmdb = findPersonByTmdbId.get(tmdbPersonId);
  if (byTmdb?.id != null) {
    personIdCache.set(tmdbPersonId, byTmdb.id);
    return byTmdb.id;
  }

  const personData = await fetchPersonDetails(tmdbPersonId);

  const personName =
    nullableText(personData?.name) ??
    nullableText(castEntry?.name) ??
    `TMDB Person ${tmdbPersonId}`;

  const byName = findPersonByName.get(personName);

  if (byName?.id != null) {
    updatePersonById.run(
      tmdbPersonId,
      nullableText(personData?.imdb_id),
      nullableText(personData?.biography),
      nullableText(personData?.birthday),
      nullableText(personData?.deathday),
      nullableNumber(personData?.gender),
      nullableText(personData?.known_for_department),
      nullableText(personData?.place_of_birth),
      nullableText(personData?.profile_path),
      byName.id,
    );

    personIdCache.set(tmdbPersonId, byName.id);
    return byName.id;
  }

  insertPerson.run(
    personName,
    tmdbPersonId,
    nullableText(personData?.imdb_id),
    nullableText(personData?.biography),
    nullableText(personData?.birthday),
    nullableText(personData?.deathday),
    nullableNumber(personData?.gender),
    nullableText(personData?.known_for_department),
    nullableText(personData?.place_of_birth),
    nullableText(personData?.profile_path),
  );

  const inserted =
    findPersonByTmdbId.get(tmdbPersonId) ?? findPersonByName.get(personName);
  const personId = inserted?.id ?? null;

  if (personId != null) {
    personIdCache.set(tmdbPersonId, personId);
  }

  return personId;
}

const insertMovieAndCast = db.transaction((movieData, castRows) => {
  insertMovie.run(
    nullableText(movieData?.title) ?? 'Unknown Title',
    nullableNumber(movieData?.id),
    nullableText(movieData?.backdrop_path),
    nullableText(movieData?.original_title),
    nullableText(movieData?.overview),
    nullableText(movieData?.poster_path),
    nullableText(movieData?.release_date),
    nullableNumber(movieData?.runtime),
    nullableText(movieData?.tagline),
  );

  const movieId = findMovieByTmdbId.get(nullableNumber(movieData?.id))?.id;
  if (movieId == null) {
    throw new Error(
      `Failed to insert movie tmdb_id=${movieData?.id ?? 'unknown'}`,
    );
  }

  let linkedCount = 0;
  for (const row of castRows) {
    upsertMovieCast.run(
      movieId,
      row.personId,
      row.castOrder,
      row.character,
      row.department,
    );
    linkedCount++;
  }

  return { movieId, linkedCount };
});

async function run() {
  ensurePeopleColumns();
  ensureMovieCastTable();

  console.log(`Collecting top ${TARGET_COUNT} popular movies from TMDB...`);
  const topMovies = await collectTopPopularMovies(TARGET_COUNT);

  let existingMovies = 0;
  let insertedMovies = 0;
  let updatedMovies = 0;
  let unchangedMovies = 0;
  let insertedCastLinks = 0;
  let failedMovies = 0;
  let fetchedPeople = 0;

  for (const topMovie of topMovies) {
    const tmdbMovieId = nullableNumber(topMovie?.id);
    if (tmdbMovieId == null) {
      continue;
    }

    const existingMovie = findMovieByTmdbId.get(tmdbMovieId) ?? null;
    if (existingMovie != null) {
      existingMovies++;
    }

    try {
      const movieDetails = await fetchMovieDetailsWithCredits(tmdbMovieId);
      await delay(REQUEST_DELAY_MS);

      if (existingMovie != null) {
        const title = nullableText(movieDetails?.title) ?? 'Unknown Title';
        const backdropPath = nullableText(movieDetails?.backdrop_path);
        const originalTitle = nullableText(movieDetails?.original_title);
        const overview = nullableText(movieDetails?.overview);
        const posterPath = nullableText(movieDetails?.poster_path);
        const releaseDate = nullableText(movieDetails?.release_date);
        const runtime = nullableNumber(movieDetails?.runtime);
        const tagline = nullableText(movieDetails?.tagline);

        const result = updateMovieById.run(
          title,
          backdropPath,
          originalTitle,
          overview,
          posterPath,
          releaseDate,
          runtime,
          tagline,
          existingMovie.id,
          title,
          backdropPath,
          originalTitle,
          overview,
          posterPath,
          releaseDate,
          runtime,
          tagline,
        );

        if (result.changes > 0) {
          updatedMovies++;
        } else {
          unchangedMovies++;
        }

        continue;
      }

      const cast = Array.isArray(movieDetails?.credits?.cast)
        ? movieDetails.credits.cast
        : [];

      const uniqueCastByTmdbId = new Map();
      for (const castEntry of cast) {
        const castTmdbId = nullableNumber(castEntry?.id);
        if (castTmdbId == null || uniqueCastByTmdbId.has(castTmdbId)) {
          continue;
        }
        uniqueCastByTmdbId.set(castTmdbId, castEntry);
      }

      const castRows = [];
      for (const castEntry of uniqueCastByTmdbId.values()) {
        const personWasKnown =
          nullableNumber(castEntry?.id) != null &&
          findPersonByTmdbId.get(nullableNumber(castEntry.id))?.id != null;

        const personId = await ensurePersonId(castEntry);
        await delay(REQUEST_DELAY_MS);

        if (personId == null) {
          continue;
        }

        if (!personWasKnown) {
          fetchedPeople++;
        }

        castRows.push({
          personId,
          castOrder: nullableNumber(castEntry?.order),
          character: nullableText(castEntry?.character),
          department:
            nullableText(castEntry?.known_for_department) ??
            nullableText(castEntry?.department) ??
            'Acting',
        });
      }

      const txResult = insertMovieAndCast(movieDetails, castRows);
      insertedMovies++;
      insertedCastLinks += txResult.linkedCount;

      if (insertedMovies % 10 === 0) {
        console.log(
          `Inserted ${insertedMovies} new movies so far; cast links ${insertedCastLinks}`,
        );
      }
    } catch (err) {
      failedMovies++;
      console.warn(`FAILED movie tmdb_id=${tmdbMovieId}: ${err.message}`);
    }
  }

  console.log('Done.');
  console.log(`Top movies checked: ${topMovies.length}`);
  console.log(`Already in DB: ${existingMovies}`);
  console.log(`Inserted movies: ${insertedMovies}`);
  console.log(`Updated existing movies: ${updatedMovies}`);
  console.log(`Unchanged existing movies: ${unchangedMovies}`);
  console.log(`Inserted/updated movie_cast links: ${insertedCastLinks}`);
  console.log(`Fetched/created missing people: ${fetchedPeople}`);
  console.log(`Failed movies: ${failedMovies}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
