#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { normalizeNameForComparison } = require('./name-normalization');

const ROOT_DIR = process.cwd();

require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  process.exit(1);
}

const DB_PATH = path.join(ROOT_DIR, 'assets', 'data', 'oscar-movies.db');
const PAGE_SIZE = 20;
const TARGET_PEOPLE_COUNT = 100;
const PAGE_COUNT = Math.ceil(TARGET_PEOPLE_COUNT / PAGE_SIZE);
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

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} ${response.status}`);
  }

  return response.json();
}

async function fetchPopularPeople(page) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    page: String(page),
  });

  return fetchJson(
    `https://api.themoviedb.org/3/person/popular?${params.toString()}`,
    `TMDB popular people page=${page}`,
  );
}

async function fetchPersonDetails(tmdbId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    append_to_response: 'combined_credits',
    language: 'en-US',
  });

  return fetchJson(
    `https://api.themoviedb.org/3/person/${tmdbId}?${params.toString()}`,
    `TMDB person id=${tmdbId}`,
  );
}

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
    'popularity REAL',
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

const selectPeople = db.prepare(`
  SELECT id, name, tmdb_id
  FROM people
`);

const findPersonByTmdbId = db.prepare(
  'SELECT id FROM people WHERE tmdb_id = ? LIMIT 1',
);

const findMovieByTmdbId = db.prepare(
  'SELECT id FROM movies WHERE tmdb_id = ? LIMIT 1',
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
    popularity,
    profile_path
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updatePerson = db.prepare(`
  UPDATE people
  SET
    name = COALESCE(?, name),
    tmdb_id = COALESCE(tmdb_id, ?),
    imdb_id = COALESCE(?, imdb_id),
    biography = COALESCE(?, biography),
    birthday = COALESCE(?, birthday),
    deathday = COALESCE(?, deathday),
    gender = COALESCE(?, gender),
    known_for_department = COALESCE(?, known_for_department),
    place_of_birth = COALESCE(?, place_of_birth),
    popularity = COALESCE(?, popularity),
    profile_path = COALESCE(?, profile_path)
  WHERE id = ?
`);

const insertMovieCast = db.prepare(`
  INSERT OR REPLACE INTO movie_cast (
    movie_id,
    person_id,
    cast_order,
    character,
    department
  ) VALUES (?, ?, ?, ?, ?)
`);

function buildPeopleNameIndex(rows) {
  const index = new Map();

  for (const row of rows) {
    const normalizedName = normalizeNameForComparison(row.name);
    if (!normalizedName || index.has(normalizedName)) {
      continue;
    }

    index.set(normalizedName, row.id);
  }

  return index;
}

function resolveExistingPersonId(detail, listPerson, peopleByNormalizedName) {
  const tmdbId = nullableNumber(detail.id ?? listPerson.id);
  const normalizedName = normalizeNameForComparison(
    nullableText(detail.name) ?? nullableText(listPerson.name) ?? '',
  );

  if (tmdbId != null) {
    const person = findPersonByTmdbId.get(tmdbId);
    if (person) {
      return person.id;
    }
  }

  if (normalizedName) {
    return peopleByNormalizedName.get(normalizedName) ?? null;
  }

  return null;
}

function upsertPersonRecord(detail, listPerson, peopleByNormalizedName) {
  const personId = resolveExistingPersonId(
    detail,
    listPerson,
    peopleByNormalizedName,
  );
  const personName =
    nullableText(detail.name) ??
    nullableText(listPerson.name) ??
    'Unknown Person';
  const tmdbId = nullableNumber(detail.id ?? listPerson.id);

  if (personId == null) {
    const inserted = insertPerson.run(
      personName,
      tmdbId,
      nullableText(detail.imdb_id),
      nullableText(detail.biography),
      nullableText(detail.birthday),
      nullableText(detail.deathday),
      nullableNumber(detail.gender),
      nullableText(detail.known_for_department),
      nullableText(detail.place_of_birth),
      nullableNumber(detail.popularity ?? listPerson.popularity),
      nullableText(detail.profile_path),
    );

    return {
      id: Number(inserted.lastInsertRowid),
      inserted: true,
    };
  }

  updatePerson.run(
    personName,
    tmdbId,
    nullableText(detail.imdb_id),
    nullableText(detail.biography),
    nullableText(detail.birthday),
    nullableText(detail.deathday),
    nullableNumber(detail.gender),
    nullableText(detail.known_for_department),
    nullableText(detail.place_of_birth),
    nullableNumber(detail.popularity ?? listPerson.popularity),
    nullableText(detail.profile_path),
    personId,
  );

  return {
    id: personId,
    inserted: false,
  };
}

function buildMovieCreditMap(combinedCredits) {
  const movieCreditsByTmdbId = new Map();

  for (const castCredit of combinedCredits?.cast ?? []) {
    if (castCredit?.media_type !== 'movie') {
      continue;
    }

    const tmdbMovieId = nullableNumber(castCredit.id);
    if (tmdbMovieId == null || movieCreditsByTmdbId.has(tmdbMovieId)) {
      continue;
    }

    movieCreditsByTmdbId.set(tmdbMovieId, {
      castOrder: nullableNumber(castCredit.order),
      character: nullableText(castCredit.character),
      department: 'Acting',
    });
  }

  for (const crewCredit of combinedCredits?.crew ?? []) {
    if (crewCredit?.media_type !== 'movie') {
      continue;
    }

    const tmdbMovieId = nullableNumber(crewCredit.id);
    if (tmdbMovieId == null || movieCreditsByTmdbId.has(tmdbMovieId)) {
      continue;
    }

    movieCreditsByTmdbId.set(tmdbMovieId, {
      castOrder: null,
      character: null,
      department:
        nullableText(crewCredit.department) ??
        nullableText(crewCredit.job) ??
        'Crew',
    });
  }

  return movieCreditsByTmdbId;
}

function backfillMovieCastForPerson(personId, combinedCredits) {
  const movieCreditsByTmdbId = buildMovieCreditMap(combinedCredits);
  let linkedRows = 0;

  for (const [tmdbMovieId, credit] of movieCreditsByTmdbId.entries()) {
    const movieId = findMovieByTmdbId.get(tmdbMovieId)?.id ?? null;
    if (movieId == null) {
      continue;
    }

    insertMovieCast.run(
      movieId,
      personId,
      credit.castOrder,
      credit.character,
      credit.department,
    );
    linkedRows++;
  }

  return linkedRows;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  ensurePeopleColumns();
  ensureMovieCastTable();

  const peopleRows = selectPeople.all();
  const peopleByNormalizedName = buildPeopleNameIndex(peopleRows);

  console.log(
    `Syncing top ${TARGET_PEOPLE_COUNT} TMDB popular people across ${PAGE_COUNT} pages...`,
  );

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let movieCastLinksUpserted = 0;
  let failed = 0;

  for (let page = 1; page <= PAGE_COUNT; page++) {
    try {
      const popularData = await fetchPopularPeople(page);
      const people = (popularData.results ?? []).slice(
        0,
        TARGET_PEOPLE_COUNT - processed,
      );

      for (const listPerson of people) {
        try {
          const detail = await fetchPersonDetails(listPerson.id);
          const result = upsertPersonRecord(
            detail,
            listPerson,
            peopleByNormalizedName,
          );

          const normalizedName = normalizeNameForComparison(
            nullableText(detail.name) ?? nullableText(listPerson.name) ?? '',
          );
          if (normalizedName) {
            peopleByNormalizedName.set(normalizedName, result.id);
          }

          if (result.inserted) {
            inserted++;
          } else {
            updated++;
          }

          movieCastLinksUpserted += backfillMovieCastForPerson(
            result.id,
            detail.combined_credits,
          );

          processed++;

          if (processed % 20 === 0 || processed === TARGET_PEOPLE_COUNT) {
            console.log(`  Synced ${processed}/${TARGET_PEOPLE_COUNT} people`);
          }

          await delay(REQUEST_DELAY_MS);
        } catch (error) {
          failed++;
          console.warn(
            `  FAILED person tmdb_id=${listPerson.id}: ${error.message}`,
          );
        }
      }

      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      failed++;
      console.warn(`FAILED popular people page=${page}: ${error.message}`);
    }
  }

  console.log('Done.');
  console.log(`  People synced: ${processed}`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  movie_cast links upserted: ${movieCastLinksUpserted}`);
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
