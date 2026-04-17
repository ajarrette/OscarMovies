#!/usr/bin/env node
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
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Step 1: Migrate schema ────────────────────────────────────────────────────
const newColumns = [
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
];

const existingColumns = db
  .prepare('PRAGMA table_info(people)')
  .all()
  .map((c) => c.name);

for (const colDef of newColumns) {
  const colName = colDef.trim().split(/\s+/)[0];
  if (!existingColumns.includes(colName)) {
    db.prepare(`ALTER TABLE people ADD COLUMN ${colDef}`).run();
    console.log(`  Added column: ${colName}`);
  }
}

// Add unique index on tmdb_id if not present (ALTER TABLE can't add constraints)
try {
  db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_people_tmdb_id ON people(tmdb_id)',
  ).run();
} catch {
  // Index may already exist with a different definition — safe to ignore
}

// ── Prepared statements ───────────────────────────────────────────────────────
const selectWithoutTmdbId = db.prepare(`
  SELECT id, name FROM people
  WHERE tmdb_id IS NULL
  ORDER BY id ASC
`);

const updateTmdbId = db.prepare(`
  UPDATE people SET tmdb_id = ? WHERE id = ? AND tmdb_id IS NULL
`);

const selectWithoutDetails = db.prepare(`
  SELECT id, tmdb_id FROM people
  WHERE tmdb_id IS NOT NULL
    AND (
      imdb_id IS NULL
      OR biography IS NULL
      OR birthday IS NULL
      OR deathday IS NULL
      OR gender IS NULL
      OR known_for_department IS NULL
      OR place_of_birth IS NULL
      OR popularity IS NULL
      OR profile_path IS NULL
    )
  ORDER BY id ASC
`);

const updateDetails = db.prepare(`
  UPDATE people SET
    imdb_id              = COALESCE(imdb_id, ?),
    biography            = COALESCE(biography, ?),
    birthday             = COALESCE(birthday, ?),
    deathday             = COALESCE(deathday, ?),
    gender               = COALESCE(gender, ?),
    known_for_department = COALESCE(known_for_department, ?),
    place_of_birth       = COALESCE(place_of_birth, ?),
    popularity           = COALESCE(popularity, ?),
    profile_path         = COALESCE(profile_path, ?)
  WHERE id = ?
`);

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function searchPerson(name) {
  const encoded = encodeURIComponent(name);
  const url = `https://api.themoviedb.org/3/search/person?query=${encoded}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB search ${res.status} for "${name}"`);
  const data = await res.json();
  const normalizedInput = normalizeNameForComparison(name);
  const match = (data.results ?? []).find(
    (r) => normalizeNameForComparison(r.name) === normalizedInput,
  );
  return match ? match.id : null;
}

async function fetchPersonDetails(tmdbId) {
  const url = `https://api.themoviedb.org/3/person/${tmdbId}?api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB person ${res.status} for id ${tmdbId}`);
  return res.json();
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Step 2: Resolve TMDB person IDs ──────────────────────────────────────────
async function resolveIds() {
  const people = selectWithoutTmdbId.all();
  console.log(`\nResolving TMDB IDs for ${people.length} people...`);

  let resolved = 0;
  let skipped = 0;

  for (const person of people) {
    try {
      const tmdbId = await searchPerson(person.name);
      if (tmdbId == null) {
        console.warn(`  SKIP (no match): "${person.name}"`);
        skipped++;
      } else {
        updateTmdbId.run(tmdbId, person.id);
        resolved++;
        if (resolved % 50 === 0)
          console.log(`  ${resolved}/${people.length} resolved`);
      }
      await delay(25);
    } catch (err) {
      console.warn(`  FAILED search for "${person.name}": ${err.message}`);
      skipped++;
    }
  }

  console.log(`ID resolution done. ${resolved} resolved, ${skipped} skipped.`);
}

// ── Step 3: Fetch and store person details ────────────────────────────────────
async function enrichDetails() {
  const people = selectWithoutDetails.all();
  console.log(`\nEnriching details for ${people.length} people...`);

  let success = 0;
  let failed = 0;

  for (const person of people) {
    try {
      const data = await fetchPersonDetails(person.tmdb_id);

      updateDetails.run(
        data.imdb_id ?? null,
        data.biography ?? null,
        data.birthday ?? null,
        data.deathday ?? null,
        data.gender ?? null,
        data.known_for_department ?? null,
        data.place_of_birth ?? null,
        data.popularity ?? null,
        data.profile_path ?? null,
        person.id,
      );

      success++;
      if (success % 50 === 0) console.log(`  ${success}/${people.length}`);

      await delay(25);
    } catch (err) {
      console.warn(`  FAILED tmdb_id=${person.tmdb_id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Detail enrichment done. ${success} updated, ${failed} failed.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  await resolveIds();
  await enrichDetails();
  console.log('\nAll done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
