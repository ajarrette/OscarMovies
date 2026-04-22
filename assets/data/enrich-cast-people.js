#!/usr/bin/env node
/* eslint-env node */
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
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_people_department_name_nocase ON people(known_for_department, name COLLATE NOCASE)',
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_nomination_people_person_nomination ON nomination_people(person_id, nomination_id)',
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_nomination_movies_nomination_ordinal_movie ON nomination_movies(nomination_id, ordinal, movie_id)',
  ).run();
}

async function fetchPersonDetails(tmdbId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
  });

  const url = `https://api.themoviedb.org/3/person/${tmdbId}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB person ${res.status} for id ${tmdbId}`);
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const selectCastPeopleWithNullBiography = db.prepare(`
  SELECT DISTINCT p.id, p.tmdb_id
  FROM people p
  INNER JOIN movie_cast mc ON mc.person_id = p.id
  WHERE p.biography IS NULL
    AND p.tmdb_id IS NOT NULL
  ORDER BY p.id ASC
`);

const updatePersonDetails = db.prepare(`
  UPDATE people
  SET
    imdb_id              = ?1,
    biography            = ?2,
    birthday             = ?3,
    deathday             = ?4,
    gender               = ?5,
    known_for_department = ?6,
    place_of_birth       = ?7,
    profile_path         = ?8,
    last_modified        = (strftime('%s','now') * 1000)
  WHERE id = ?9
    AND biography IS NULL
    AND (
      imdb_id IS NOT ?1
      OR biography IS NOT ?2
      OR birthday IS NOT ?3
      OR deathday IS NOT ?4
      OR gender IS NOT ?5
      OR known_for_department IS NOT ?6
      OR place_of_birth IS NOT ?7
      OR profile_path IS NOT ?8
    )
`);

async function run() {
  ensurePeopleColumns();

  const people = selectCastPeopleWithNullBiography.all();
  console.log(`Enriching cast people for ${people.length} rows...`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const person of people) {
    try {
      const data = await fetchPersonDetails(person.tmdb_id);

      const result = updatePersonDetails.run(
        nullableText(data.imdb_id),
        nullableText(data.biography),
        nullableText(data.birthday),
        nullableText(data.deathday),
        nullableNumber(data.gender),
        nullableText(data.known_for_department),
        nullableText(data.place_of_birth),
        nullableText(data.profile_path),
        person.id,
      );

      if (result.changes > 0) {
        updated++;
        if (updated % 50 === 0) {
          console.log(`  Updated ${updated}/${people.length}`);
        }
      } else {
        skipped++;
      }

      await delay(REQUEST_DELAY_MS);
    } catch (err) {
      failed++;
      console.warn(`  FAILED tmdb_id=${person.tmdb_id}: ${err.message}`);
    }
  }

  console.log('Done.');
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
