#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
const { normalizeNameForComparison } = require('../name-normalization');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');

require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const API_KEY = process.env.TMDB_API_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL in .env');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const PAGE_SIZE = 20;
const TARGET_PEOPLE_COUNT = 1;
const PAGE_COUNT = Math.ceil(TARGET_PEOPLE_COUNT / PAGE_SIZE);
const REQUEST_DELAY_MS = 25;
const SUPABASE_PAGE_SIZE = 1000;

const SUPABASE_REST_BASE = buildSupabaseRestBase(SUPABASE_URL);

function buildSupabaseRestBase(url) {
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/rest/v1')) {
    return trimmed;
  }

  return `${trimmed}/rest/v1`;
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compactPayload(payload) {
  const result = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
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

async function supabaseRequest(method, table, { query, payload, prefer } = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) {
      params.set(key, String(value));
    }
  }

  const url = `${SUPABASE_REST_BASE}/${table}${
    params.size > 0 ? `?${params.toString()}` : ''
  }`;

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase ${method} ${table} ${response.status}: ${body.slice(0, 240)}`,
    );
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

async function selectSingle(table, query) {
  const rows = await supabaseRequest('GET', table, {
    query: { ...query, limit: 1 },
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
}

async function fetchAllRows(table, selectColumns) {
  const rows = [];

  for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
    const page = await supabaseRequest('GET', table, {
      query: {
        select: selectColumns,
        limit: SUPABASE_PAGE_SIZE,
        offset,
      },
    });

    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function insertRow(table, payload) {
  const rows = await supabaseRequest('POST', table, {
    payload,
    prefer: 'return=representation',
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Insert into ${table} returned no row`);
  }

  return rows[0];
}

async function updateById(table, id, payload) {
  const compact = compactPayload(payload);
  if (Object.keys(compact).length === 0) {
    return;
  }

  await supabaseRequest('PATCH', table, {
    query: { id: `eq.${id}` },
    payload: compact,
    prefer: 'return=minimal',
  });
}

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

function buildPeopleTmdbIndex(rows) {
  const index = new Map();

  for (const row of rows) {
    const tmdbId = nullableNumber(row.tmdb_id);
    if (tmdbId == null || index.has(tmdbId)) {
      continue;
    }

    index.set(tmdbId, row.id);
  }

  return index;
}

function buildMovieTmdbIndex(rows) {
  const index = new Map();

  for (const row of rows) {
    const tmdbId = nullableNumber(row.tmdb_id);
    if (tmdbId == null || index.has(tmdbId)) {
      continue;
    }

    index.set(tmdbId, row.id);
  }

  return index;
}

function resolveExistingPersonId(
  detail,
  listPerson,
  peopleByTmdbId,
  peopleByNormalizedName,
) {
  const tmdbId = nullableNumber(detail.id ?? listPerson.id);
  const normalizedName = normalizeNameForComparison(
    nullableText(detail.name) ?? nullableText(listPerson.name) ?? '',
  );

  if (tmdbId != null && peopleByTmdbId.has(tmdbId)) {
    return peopleByTmdbId.get(tmdbId) ?? null;
  }

  if (normalizedName) {
    return peopleByNormalizedName.get(normalizedName) ?? null;
  }

  return null;
}

async function upsertPersonRecord(
  detail,
  listPerson,
  peopleByTmdbId,
  peopleByNormalizedName,
) {
  const personId = resolveExistingPersonId(
    detail,
    listPerson,
    peopleByTmdbId,
    peopleByNormalizedName,
  );
  const personName =
    nullableText(detail.name) ??
    nullableText(listPerson.name) ??
    'Unknown Person';
  const tmdbId = nullableNumber(detail.id ?? listPerson.id);

  const payload = compactPayload({
    name: personName,
    tmdb_id: tmdbId,
    imdb_id: nullableText(detail.imdb_id),
    biography: nullableText(detail.biography),
    birthday: nullableText(detail.birthday),
    deathday: nullableText(detail.deathday),
    gender: nullableNumber(detail.gender),
    known_for_department: nullableText(detail.known_for_department),
    place_of_birth: nullableText(detail.place_of_birth),
    profile_path: nullableText(detail.profile_path),
    last_modified: Date.now(),
  });

  if (personId == null) {
    const inserted = await insertRow('people', payload);

    const insertedId = inserted.id;
    if (tmdbId != null) {
      peopleByTmdbId.set(tmdbId, insertedId);
    }

    const normalizedInsertedName = normalizeNameForComparison(personName);
    if (
      normalizedInsertedName &&
      !peopleByNormalizedName.has(normalizedInsertedName)
    ) {
      peopleByNormalizedName.set(normalizedInsertedName, insertedId);
    }

    return {
      id: insertedId,
      inserted: true,
    };
  }

  await updateById('people', personId, payload);

  if (tmdbId != null && !peopleByTmdbId.has(tmdbId)) {
    peopleByTmdbId.set(tmdbId, personId);
  }

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

async function backfillMovieCastForPerson(
  personId,
  combinedCredits,
  moviesByTmdbId,
) {
  const movieCreditsByTmdbId = buildMovieCreditMap(combinedCredits);
  let linkedRows = 0;

  for (const [tmdbMovieId, credit] of movieCreditsByTmdbId.entries()) {
    const movieId = moviesByTmdbId.get(tmdbMovieId) ?? null;
    if (movieId == null) {
      continue;
    }

    await supabaseRequest('POST', 'movie_cast', {
      query: { on_conflict: 'movie_id,person_id' },
      payload: {
        movie_id: movieId,
        person_id: personId,
        cast_order: credit.castOrder,
        character: credit.character,
        department: credit.department,
        last_modified: new Date().toISOString(),
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });

    linkedRows++;
  }

  return linkedRows;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const peopleRows = await fetchAllRows('people', 'id,name,tmdb_id');
  const moviesRows = await fetchAllRows('movies', 'id,tmdb_id');

  const peopleByNormalizedName = buildPeopleNameIndex(peopleRows);
  const peopleByTmdbId = buildPeopleTmdbIndex(peopleRows);
  const moviesByTmdbId = buildMovieTmdbIndex(moviesRows);

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
          const result = await upsertPersonRecord(
            detail,
            listPerson,
            peopleByTmdbId,
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

          movieCastLinksUpserted += await backfillMovieCastForPerson(
            result.id,
            detail.combined_credits,
            moviesByTmdbId,
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

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
