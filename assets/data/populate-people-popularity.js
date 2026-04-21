#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TMDB_API_KEY) {
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

const TARGET_COUNT = 100;
const REQUEST_DELAY_MS = 50;
const UPSERT_BATCH_SIZE = 50;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GENERAL_TABLE_NAME = 'people_popularity';

function getRestBaseUrl(url) {
  const trimmed = String(url).trim().replace(/\/$/, '');
  return trimmed.endsWith('/rest/v1') ? trimmed : `${trimmed}/rest/v1`;
}

const SUPABASE_REST_BASE_URL = getRestBaseUrl(SUPABASE_URL);

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function fetchJson(url, label, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${label} ${res.status}${body ? ` ${body}` : ''}`);
  }
  return res.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

async function canPopulateNow(tableName) {
  const params = new URLSearchParams({
    select: 'table_name,last_modified',
    table_name: `eq.${tableName}`,
    limit: '1',
  });
  const url = `${SUPABASE_REST_BASE_URL}/general?${params.toString()}`;
  const rows = await fetchJson(url, `Supabase read general ${tableName}`, {
    headers: getSupabaseHeaders(),
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  const lastModified = row?.last_modified;

  if (!lastModified) {
    console.log(
      `No last_modified found in general for ${tableName}; proceeding with population.`,
    );
    return true;
  }

  const lastDate = new Date(lastModified);
  if (Number.isNaN(lastDate.getTime())) {
    console.warn(
      `Invalid last_modified value in general for ${tableName}: ${lastModified}. Proceeding anyway.`,
    );
    return true;
  }

  const nextAllowed = new Date(lastDate.getTime() + COOLDOWN_MS);
  const now = new Date();

  if (now < nextAllowed) {
    const remainingMs = nextAllowed.getTime() - now.getTime();
    console.log(
      `Skipping ${tableName}: last_modified=${lastDate.toISOString()}.`,
    );
    console.log(
      `You can populate again at ${nextAllowed.toISOString()} (${formatRemaining(
        remainingMs,
      )} remaining).`,
    );
    return false;
  }

  console.log(
    `Cooldown passed for ${tableName}. Last modified at ${lastDate.toISOString()}.`,
  );
  return true;
}

async function setGeneralLastModified(tableName, isoTimestamp) {
  const patchParams = new URLSearchParams({
    table_name: `eq.${tableName}`,
  });

  const patchUrl = `${SUPABASE_REST_BASE_URL}/general?${patchParams.toString()}`;
  const updatedRows = await fetchJson(
    patchUrl,
    `Supabase update general ${tableName}`,
    {
      method: 'PATCH',
      headers: {
        ...getSupabaseHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ last_modified: isoTimestamp }),
    },
  );

  if (Array.isArray(updatedRows) && updatedRows.length > 0) {
    return;
  }

  const upsertUrl = `${SUPABASE_REST_BASE_URL}/general?on_conflict=table_name`;
  await fetchJson(upsertUrl, `Supabase upsert general ${tableName}`, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([
      {
        table_name: tableName,
        last_modified: isoTimestamp,
      },
    ]),
  });
}

async function fetchPopularPeople(page) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: 'en-US',
    page: String(page),
  });

  return fetchJson(
    `https://api.themoviedb.org/3/person/popular?${params.toString()}`,
    `TMDB person/popular page=${page}`,
  );
}

async function collectTopPeople(targetCount) {
  const rows = [];
  const seen = new Set();
  let page = 1;

  while (rows.length < targetCount) {
    const data = await fetchPopularPeople(page);
    const results = data.results ?? [];

    if (results.length === 0) {
      break;
    }

    for (const person of results) {
      const tmdbId = person?.id;
      if (tmdbId == null || seen.has(tmdbId)) {
        continue;
      }

      rows.push({
        tmdb_id: tmdbId,
        popularity: nullableNumber(person?.popularity),
        // TODO: On future runs, compute difference from prior stored popularity.
        difference: 0,
      });
      seen.add(tmdbId);

      if (rows.length >= targetCount) {
        break;
      }
    }

    console.log(
      `Fetched page ${page}; collected ${rows.length}/${targetCount}`,
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

async function upsertPeople(rows) {
  let upserted = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const url = `${SUPABASE_REST_BASE_URL}/people_popularity?on_conflict=tmdb_id`;

    const data = await fetchJson(url, 'Supabase upsert people_popularity', {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(batch),
    });

    upserted += Array.isArray(data) ? data.length : batch.length;
    console.log(`Upserted batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}`);
    await delay(REQUEST_DELAY_MS);
  }

  return upserted;
}

async function run() {
  let fetchedCount = 0;
  let upsertedCount = 0;
  let failedCount = 0;

  try {
    console.log(`Checking populate cooldown for ${GENERAL_TABLE_NAME}...`);
    const allowed = await canPopulateNow(GENERAL_TABLE_NAME);
    if (!allowed) {
      return;
    }

    console.log(`Fetching top ${TARGET_COUNT} TMDB people...`);
    const rows = await collectTopPeople(TARGET_COUNT);
    fetchedCount = rows.length;

    console.log(
      `Upserting ${rows.length} rows into people_popularity via Supabase REST...`,
    );
    upsertedCount = await upsertPeople(rows);

    const nowIso = new Date().toISOString();
    await setGeneralLastModified(GENERAL_TABLE_NAME, nowIso);
    console.log(
      `Updated general.last_modified for ${GENERAL_TABLE_NAME} to ${nowIso}.`,
    );
  } catch (err) {
    failedCount += 1;
    throw err;
  } finally {
    console.log('Done.');
    console.log(`  Fetched: ${fetchedCount}`);
    console.log(`  Upserted: ${upsertedCount}`);
    console.log(`  Failed: ${failedCount}`);
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
