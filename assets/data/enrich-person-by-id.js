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

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function parsePositiveInteger(value, name) {
  if (!/^\d+$/.test(value ?? '')) {
    throw new Error(`${name} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function fetchPersonDetails(tmdbId) {
  const url = `https://api.themoviedb.org/3/person/${tmdbId}?api_key=${API_KEY}`;
  const res = await fetch(url);

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = body ? ` - ${body.slice(0, 300)}` : '';
    } catch {
      detail = '';
    }
    throw new Error(
      `TMDB person ${res.status} ${res.statusText} for id ${tmdbId}${detail}`,
    );
  }

  return res.json();
}

const selectPersonById = db.prepare('SELECT id, name FROM people WHERE id = ?');

const updatePersonById = db.prepare(`
  UPDATE people
  SET
    tmdb_id              = ?,
    imdb_id              = ?,
    biography            = ?,
    birthday             = ?,
    deathday             = ?,
    gender               = ?,
    known_for_department = ?,
    place_of_birth       = ?,
    popularity           = ?,
    profile_path         = ?
  WHERE id = ?
`);

async function run() {
  const [rawPeopleId, rawTmdbId] = process.argv.slice(2);

  if (!rawPeopleId || !rawTmdbId || process.argv.slice(2).length !== 2) {
    console.error(
      'Usage: node ./assets/data/enrich-person-by-id.js <people_id> <tmdb_id>',
    );
    process.exit(1);
  }

  const peopleId = parsePositiveInteger(rawPeopleId, 'people_id');
  const tmdbId = parsePositiveInteger(rawTmdbId, 'tmdb_id');

  console.log(
    `Starting enrichment for people.id=${peopleId}, tmdb_id=${tmdbId}`,
  );

  const person = selectPersonById.get(peopleId);
  if (!person) {
    console.error(`No people row found for id=${peopleId}`);
    process.exit(1);
  }

  let data;
  try {
    data = await fetchPersonDetails(tmdbId);
  } catch (err) {
    console.error(`TMDB fetch failed for tmdb_id=${tmdbId}: ${err.message}`);
    process.exit(1);
  }

  const result = updatePersonById.run(
    tmdbId,
    nullableText(data.imdb_id),
    nullableText(data.biography),
    nullableText(data.birthday),
    nullableText(data.deathday),
    nullableNumber(data.gender),
    nullableText(data.known_for_department),
    nullableText(data.place_of_birth),
    nullableNumber(data.popularity),
    nullableText(data.profile_path),
    peopleId,
  );

  if (result.changes !== 1) {
    console.error(`Update failed for people.id=${peopleId}`);
    process.exit(1);
  }

  console.log(
    `Successfully enriched people.id=${peopleId} (${person.name}) with tmdb_id=${tmdbId}`,
  );
}

run()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
