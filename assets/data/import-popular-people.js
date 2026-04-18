#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { normalizeNameForComparison } = require('./name-normalization');
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
const PAGE_SIZE = 20;
const TARGET_PEOPLE_COUNT = 5000;
const PAGE_COUNT = Math.ceil(TARGET_PEOPLE_COUNT / PAGE_SIZE);
const REQUEST_DELAY_MS = 25;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const existingColumns = db
  .prepare('PRAGMA table_info(people)')
  .all()
  .map((column) => column.name);

const requiredColumns = [
  'tmdb_id             INTEGER',
  'imdb_id             TEXT',
  'biography           TEXT',
  'birthday            TEXT',
  'deathday            TEXT',
  'gender              INTEGER',
  'known_for_department TEXT',
  'place_of_birth      TEXT',
  'popularity          REAL',
  'profile_path        TEXT',
  'wins                INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0)',
  'nominations         INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0)',
];

for (const columnDef of requiredColumns) {
  const columnName = columnDef.trim().split(/\s+/)[0];
  if (!existingColumns.includes(columnName)) {
    db.prepare(`ALTER TABLE people ADD COLUMN ${columnDef}`).run();
    console.log(`Added column: ${columnName}`);
  }
}

db.prepare(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_people_tmdb_id ON people(tmdb_id)',
).run();
db.prepare(
  'CREATE INDEX IF NOT EXISTS idx_people_department_name_nocase ON people(known_for_department, name COLLATE NOCASE)',
).run();
db.prepare(
  'CREATE INDEX IF NOT EXISTS idx_nomination_people_person_nomination ON nomination_people(person_id, nomination_id)',
).run();
db.prepare(
  'CREATE INDEX IF NOT EXISTS idx_nomination_movies_nomination_ordinal_movie ON nomination_movies(nomination_id, ordinal, movie_id)',
).run();

const selectExistingPeople = db.prepare(`
  SELECT name, tmdb_id FROM people
`);

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
    popularity,
    profile_path
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function fetchJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label} ${res.status}`);
  }
  return res.json();
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
    language: 'en-US',
  });

  return fetchJson(
    `https://api.themoviedb.org/3/person/${tmdbId}?${params.toString()}`,
    `TMDB person id=${tmdbId}`,
  );
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const existingPeople = selectExistingPeople.all();
  const existingTmdbIds = new Set(
    existingPeople
      .map((person) => person.tmdb_id)
      .filter((tmdbId) => tmdbId != null),
  );
  const existingNames = new Set(
    existingPeople
      .map((person) => normalizeNameForComparison(person.name))
      .filter(Boolean),
  );

  console.log(
    `Scanning TMDB popular people (top ${TARGET_PEOPLE_COUNT}, ${PAGE_COUNT} pages)...`,
  );
  console.log(
    `Existing people in DB: ${existingPeople.length} (${existingTmdbIds.size} with tmdb_id)`,
  );

  let inserted = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (let page = 1; page <= PAGE_COUNT; page++) {
    try {
      const data = await fetchPopularPeople(page);
      const results = data.results ?? [];

      for (const person of results) {
        const tmdbId = person.id;
        const normalizedName = normalizeNameForComparison(person.name);

        if (
          tmdbId == null ||
          existingTmdbIds.has(tmdbId) ||
          (normalizedName && existingNames.has(normalizedName))
        ) {
          skippedExisting++;
          continue;
        }

        try {
          const detail = await fetchPersonDetails(tmdbId);
          const insertedInfo = insertPerson.run(
            nullableText(detail.name) ??
              nullableText(person.name) ??
              'Unknown Person',
            tmdbId,
            nullableText(detail.imdb_id),
            nullableText(detail.biography),
            nullableText(detail.birthday),
            nullableText(detail.deathday),
            nullableNumber(detail.gender),
            nullableText(detail.known_for_department),
            nullableText(detail.place_of_birth),
            nullableNumber(detail.popularity),
            nullableText(detail.profile_path),
          );

          if (insertedInfo.changes > 0) {
            existingTmdbIds.add(tmdbId);
            if (normalizedName) existingNames.add(normalizedName);
            inserted++;

            if (inserted % 50 === 0) {
              console.log(`  Inserted ${inserted} new people so far`);
            }
          } else {
            skippedExisting++;
          }

          await delay(REQUEST_DELAY_MS);
        } catch (err) {
          console.warn(`  FAILED person id=${tmdbId}: ${err.message}`);
          failed++;
        }
      }

      if (page % 10 === 0 || page === PAGE_COUNT) {
        console.log(`Processed page ${page}/${PAGE_COUNT}`);
      }

      await delay(REQUEST_DELAY_MS);
    } catch (err) {
      console.warn(`FAILED popular people page=${page}: ${err.message}`);
      failed++;
    }
  }

  console.log('Done.');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped existing: ${skippedExisting}`);
  console.log(`  Failed: ${failed}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
