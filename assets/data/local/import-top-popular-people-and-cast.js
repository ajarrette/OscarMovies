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

async function fetchPopularPeople(page) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    page: String(page),
  });

  const url = `https://api.themoviedb.org/3/person/popular?${params.toString()}`;
  return fetchJson(url, `TMDB person/popular page=${page}`);
}

async function fetchPersonDetails(tmdbPersonId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
  });

  const url = `https://api.themoviedb.org/3/person/${tmdbPersonId}?${params.toString()}`;
  return fetchJson(url, `TMDB person details id=${tmdbPersonId}`);
}

async function fetchPersonMovieCredits(tmdbPersonId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
  });

  const url = `https://api.themoviedb.org/3/person/${tmdbPersonId}/movie_credits?${params.toString()}`;
  return fetchJson(url, `TMDB person movie credits id=${tmdbPersonId}`);
}

async function collectTopPopularPeople(targetCount) {
  const rows = [];
  const seen = new Set();
  let page = 1;

  while (rows.length < targetCount) {
    const data = await fetchPopularPeople(page);
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0) {
      break;
    }

    for (const person of results) {
      const tmdbId = nullableNumber(person?.id);
      if (tmdbId == null || seen.has(tmdbId)) {
        continue;
      }

      seen.add(tmdbId);
      rows.push(person);

      if (rows.length >= targetCount) {
        break;
      }
    }

    console.log(
      `Fetched person/popular page ${page}; ${rows.length}/${targetCount}`,
    );
    page += 1;
    await delay(REQUEST_DELAY_MS);
  }

  if (rows.length < targetCount) {
    throw new Error(
      `Could only collect ${rows.length} people from TMDB (target ${targetCount})`,
    );
  }

  return rows;
}

const findPersonByTmdbId = db.prepare(
  'SELECT id FROM people WHERE tmdb_id = ? LIMIT 1',
);
const findPersonByName = db.prepare(
  'SELECT id FROM people WHERE name = ? LIMIT 1',
);

const insertPerson = db.prepare(`
  INSERT INTO people (
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
    name = ?,
    tmdb_id = ?,
    imdb_id = ?,
    biography = ?,
    birthday = ?,
    deathday = ?,
    gender = ?,
    known_for_department = ?,
    place_of_birth = ?,
    profile_path = ?,
    last_modified = (datetime('now'))
  WHERE id = ?
    AND (
      name IS NOT ?
      OR tmdb_id IS NOT ?
      OR imdb_id IS NOT ?
      OR biography IS NOT ?
      OR birthday IS NOT ?
      OR deathday IS NOT ?
      OR gender IS NOT ?
      OR known_for_department IS NOT ?
      OR place_of_birth IS NOT ?
      OR profile_path IS NOT ?
    )
`);

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
    last_modified
  ) VALUES (?, ?, ?, ?, ?, ?, ?, (datetime('now')))
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

const processPerson = db.transaction(
  (personRow, personDetails, movieCastRows) => {
    const name =
      nullableText(personDetails?.name) ??
      nullableText(personRow?.name) ??
      `TMDB Person ${personRow.tmdb_id}`;
    const tmdbId = personRow.tmdb_id;
    const imdbId = nullableText(personDetails?.imdb_id);
    const biography = nullableText(personDetails?.biography);
    const birthday = nullableText(personDetails?.birthday);
    const deathday = nullableText(personDetails?.deathday);
    const gender = nullableNumber(personDetails?.gender);
    const knownForDepartment =
      nullableText(personDetails?.known_for_department) ??
      nullableText(personRow?.known_for_department);
    const placeOfBirth = nullableText(personDetails?.place_of_birth);
    const profilePath =
      nullableText(personDetails?.profile_path) ??
      nullableText(personRow?.profile_path);

    let personId = findPersonByTmdbId.get(tmdbId)?.id ?? null;
    if (personId == null) {
      const byName = findPersonByName.get(name);
      personId = byName?.id ?? null;
    }

    let insertedPerson = false;
    let updatedPerson = false;

    if (personId == null) {
      insertPerson.run(
        name,
        tmdbId,
        imdbId,
        biography,
        birthday,
        deathday,
        gender,
        knownForDepartment,
        placeOfBirth,
        profilePath,
      );
      personId =
        findPersonByTmdbId.get(tmdbId)?.id ??
        findPersonByName.get(name)?.id ??
        null;
      insertedPerson = personId != null;
    }

    if (personId == null) {
      throw new Error(`Unable to resolve person row for tmdb_id=${tmdbId}`);
    }

    const personUpdateResult = updatePersonById.run(
      name,
      tmdbId,
      imdbId,
      biography,
      birthday,
      deathday,
      gender,
      knownForDepartment,
      placeOfBirth,
      profilePath,
      personId,
      name,
      tmdbId,
      imdbId,
      biography,
      birthday,
      deathday,
      gender,
      knownForDepartment,
      placeOfBirth,
      profilePath,
    );
    if (personUpdateResult.changes > 0) {
      updatedPerson = true;
    }

    let insertedMovies = 0;
    let castLinks = 0;

    for (const castMovie of movieCastRows) {
      const movieTmdbId = nullableNumber(castMovie?.id);
      if (movieTmdbId == null) {
        continue;
      }

      let movieId = findMovieByTmdbId.get(movieTmdbId)?.id ?? null;
      if (movieId == null) {
        insertMovie.run(
          nullableText(castMovie?.title) ?? 'Unknown Title',
          movieTmdbId,
          nullableText(castMovie?.backdrop_path),
          nullableText(castMovie?.original_title),
          nullableText(castMovie?.overview),
          nullableText(castMovie?.poster_path),
          nullableText(castMovie?.release_date),
        );
        movieId = findMovieByTmdbId.get(movieTmdbId)?.id ?? null;
        if (movieId != null) {
          insertedMovies++;
        }
      }

      if (movieId == null) {
        continue;
      }

      upsertMovieCast.run(
        movieId,
        personId,
        nullableNumber(castMovie?.order),
        nullableText(castMovie?.character),
        'Acting',
      );
      castLinks++;
    }

    return {
      insertedPerson,
      updatedPerson,
      insertedMovies,
      castLinks,
    };
  },
);

async function run() {
  ensurePeopleColumns();
  ensureMovieCastTable();

  console.log(`Collecting top ${TARGET_COUNT} popular people from TMDB...`);
  const topPeople = await collectTopPopularPeople(TARGET_COUNT);

  let insertedPeople = 0;
  let updatedPeople = 0;
  let unchangedPeople = 0;
  let insertedMovies = 0;
  let upsertedCastLinks = 0;
  let failedPeople = 0;

  for (const popularPerson of topPeople) {
    const tmdbPersonId = nullableNumber(popularPerson?.id);
    if (tmdbPersonId == null) {
      continue;
    }

    try {
      const details = await fetchPersonDetails(tmdbPersonId);
      await delay(REQUEST_DELAY_MS);

      const credits = await fetchPersonMovieCredits(tmdbPersonId);
      await delay(REQUEST_DELAY_MS);

      const castRows = Array.isArray(credits?.cast) ? credits.cast : [];
      const uniqueCastByMovieId = new Map();
      for (const castMovie of castRows) {
        const castMovieId = nullableNumber(castMovie?.id);
        if (castMovieId == null || uniqueCastByMovieId.has(castMovieId)) {
          continue;
        }
        uniqueCastByMovieId.set(castMovieId, castMovie);
      }

      const result = processPerson(
        {
          tmdb_id: tmdbPersonId,
          name: nullableText(popularPerson?.name),
          known_for_department: nullableText(
            popularPerson?.known_for_department,
          ),
          profile_path: nullableText(popularPerson?.profile_path),
        },
        details,
        [...uniqueCastByMovieId.values()],
      );

      if (result.insertedPerson) {
        insertedPeople++;
      }
      if (result.updatedPerson) {
        updatedPeople++;
      }
      if (!result.insertedPerson && !result.updatedPerson) {
        unchangedPeople++;
      }

      insertedMovies += result.insertedMovies;
      upsertedCastLinks += result.castLinks;

      const processed =
        insertedPeople + updatedPeople + unchangedPeople + failedPeople;
      if (processed % 10 === 0) {
        console.log(
          `Processed ${processed}/${topPeople.length}; inserted people ${insertedPeople}, updated people ${updatedPeople}, inserted movies ${insertedMovies}`,
        );
      }
    } catch (err) {
      failedPeople++;
      console.warn(`FAILED person tmdb_id=${tmdbPersonId}: ${err.message}`);
    }
  }

  console.log('Done.');
  console.log(`Top people checked: ${topPeople.length}`);
  console.log(`Inserted people: ${insertedPeople}`);
  console.log(`Updated people: ${updatedPeople}`);
  console.log(`Unchanged people: ${unchangedPeople}`);
  console.log(`Inserted movies from credits: ${insertedMovies}`);
  console.log(`Inserted/updated movie_cast links: ${upsertedCastLinks}`);
  console.log(`Failed people: ${failedPeople}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
