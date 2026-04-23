#!/usr/bin/env node
/* eslint-env node */
'use strict';

const path = require('path');

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

const DISCOVER_PAGE_SIZE = 20;
const TARGET_MOVIE_COUNT = 1;
const PAGE_COUNT = Math.ceil(TARGET_MOVIE_COUNT / DISCOVER_PAGE_SIZE);
const REQUEST_DELAY_MS = 25;

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

async function deleteByFilter(table, query) {
  await supabaseRequest('DELETE', table, {
    query,
    prefer: 'return=minimal',
  });
}

async function findMovieByTmdbId(tmdbId) {
  if (tmdbId == null) {
    return null;
  }

  return selectSingle('movies', {
    select: 'id',
    tmdb_id: `eq.${tmdbId}`,
  });
}

async function findMovieByImdbId(imdbId) {
  if (!imdbId) {
    return null;
  }

  return selectSingle('movies', {
    select: 'id',
    imdb_id: `eq.${imdbId}`,
  });
}

async function findMovieByTitle(title) {
  if (!title) {
    return null;
  }

  return selectSingle('movies', {
    select: 'id',
    title: `eq.${title}`,
  });
}

async function findPersonByTmdbId(tmdbId) {
  if (tmdbId == null) {
    return null;
  }

  return selectSingle('people', {
    select: 'id',
    tmdb_id: `eq.${tmdbId}`,
  });
}

async function resolveExistingMovieId(detail, discoverMovie) {
  const tmdbId = nullableNumber(detail.id ?? discoverMovie.id);
  const imdbId = nullableText(detail.imdb_id);
  const title = nullableText(detail.title) ?? nullableText(discoverMovie.title);

  const byTmdb = await findMovieByTmdbId(tmdbId);
  if (byTmdb) {
    return byTmdb.id;
  }

  const byImdb = await findMovieByImdbId(imdbId);
  if (byImdb) {
    return byImdb.id;
  }

  const byTitle = await findMovieByTitle(title);
  if (byTitle) {
    return byTitle.id;
  }

  return null;
}

async function upsertMovie(detail, discoverMovie) {
  const tmdbId = nullableNumber(detail.id ?? discoverMovie.id);
  const movieTitle =
    nullableText(detail.title) ??
    nullableText(discoverMovie.title) ??
    'Untitled';
  const movieId = await resolveExistingMovieId(detail, discoverMovie);

  const payload = compactPayload({
    title: movieTitle,
    tmdb_id: tmdbId,
    imdb_id: nullableText(detail.imdb_id),
    backdrop_path: nullableText(detail.backdrop_path),
    original_title: nullableText(detail.original_title),
    overview: nullableText(detail.overview),
    poster_path: nullableText(detail.poster_path),
    release_date: nullableText(detail.release_date),
    runtime: nullableNumber(detail.runtime),
    tagline: nullableText(detail.tagline),
    director: nullableText(getDirectorName(detail.credits)),
    last_modified: new Date().toISOString(),
  });

  if (movieId == null) {
    const inserted = await insertRow('movies', payload);
    return { id: inserted.id, inserted: true };
  }

  await updateById('movies', movieId, payload);
  return { id: movieId, inserted: false };
}

async function upsertPersonForCredit(credit) {
  const tmdbPersonId = nullableNumber(credit.tmdbPersonId);
  if (tmdbPersonId == null) {
    return null;
  }

  const existing = await findPersonByTmdbId(tmdbPersonId);
  const payload = compactPayload({
    name: credit.name,
    tmdb_id: tmdbPersonId,
    profile_path: credit.profilePath,
    known_for_department: credit.department,
    last_modified: new Date().toISOString(),
  });

  if (existing) {
    await updateById('people', existing.id, payload);
    return existing.id;
  }

  const inserted = await insertRow('people', payload);
  return inserted.id ?? null;
}

function buildCreditMap(credits) {
  const creditByTmdbPersonId = new Map();

  // Prefer cast entries where possible for character/order detail.
  for (const castPerson of credits.cast ?? []) {
    const tmdbPersonId = nullableNumber(castPerson.id);
    if (tmdbPersonId == null || creditByTmdbPersonId.has(tmdbPersonId)) {
      continue;
    }

    creditByTmdbPersonId.set(tmdbPersonId, {
      tmdbPersonId,
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
      tmdbPersonId,
      name: nullableText(crewPerson.name) ?? 'Unknown Person',
      profilePath: nullableText(crewPerson.profile_path),
      department: normalizeCrewDepartment(crewPerson),
      castOrder: null,
      character: null,
    });
  }

  return creditByTmdbPersonId;
}

async function upsertMovieCast(movieId, credits) {
  await deleteByFilter('movie_cast', { movie_id: `eq.${movieId}` });

  const creditByTmdbPersonId = buildCreditMap(credits);
  let linkedRows = 0;

  for (const credit of creditByTmdbPersonId.values()) {
    const personId = await upsertPersonForCredit(credit);
    if (personId == null) {
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
          const movieResult = await upsertMovie(detail, discoverMovie);

          if (movieResult.inserted) {
            inserted++;
          } else {
            updated++;
          }

          castLinks += await upsertMovieCast(
            movieResult.id,
            detail.credits ?? {},
          );
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

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
