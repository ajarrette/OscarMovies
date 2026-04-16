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
const DISCOVER_PAGE_SIZE = 20;
const TARGET_MOVIE_COUNT = 5000;
const PAGE_COUNT = Math.ceil(TARGET_MOVIE_COUNT / DISCOVER_PAGE_SIZE);
const REQUEST_DELAY_MS = 25;

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const selectExistingTmdbIds = db.prepare(`
  SELECT tmdb_id FROM movies
  WHERE tmdb_id IS NOT NULL
`);

const insertMovie = db.prepare(`
  INSERT OR IGNORE INTO movies (
    title,
    tmdb_id,
    imdb_id,
    backdrop_path,
    original_title,
    overview,
    popularity,
    poster_path,
    release_date,
    runtime,
    tagline,
    director
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function fetchJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label} ${res.status}`);
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

function getDirectorName(credits) {
  return (
    credits?.crew?.find((member) => member.job === 'Director')?.name ?? null
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
  const existingTmdbIds = new Set(
    selectExistingTmdbIds.all().map((row) => row.tmdb_id),
  );

  console.log(
    `Scanning TMDB popularity rankings (top ${TARGET_MOVIE_COUNT}, ${PAGE_COUNT} pages)...`,
  );
  console.log(`Existing movies in DB with tmdb_id: ${existingTmdbIds.size}`);

  let inserted = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (let page = 1; page <= PAGE_COUNT; page++) {
    try {
      const data = await discoverPopularMovies(page);
      const results = data.results ?? [];

      for (const movie of results) {
        const tmdbId = movie.id;

        if (tmdbId == null || existingTmdbIds.has(tmdbId)) {
          skippedExisting++;
          continue;
        }

        try {
          const detail = await fetchMovieDetails(tmdbId);

          insertMovie.run(
            nullableText(detail.title) ??
              nullableText(movie.title) ??
              'Untitled',
            tmdbId,
            nullableText(detail.imdb_id),
            nullableText(detail.backdrop_path),
            nullableText(detail.original_title),
            nullableText(detail.overview),
            nullableNumber(detail.popularity),
            nullableText(detail.poster_path),
            nullableText(detail.release_date),
            nullableNumber(detail.runtime),
            nullableText(detail.tagline),
            nullableText(getDirectorName(detail.credits)),
          );

          existingTmdbIds.add(tmdbId);
          inserted++;

          if (inserted % 50 === 0) {
            console.log(`  Inserted ${inserted} new movies so far`);
          }

          await delay(REQUEST_DELAY_MS);
        } catch (err) {
          console.warn(`  FAILED movie id=${tmdbId}: ${err.message}`);
          failed++;
        }
      }

      if (page % 10 === 0 || page === PAGE_COUNT) {
        console.log(`Processed page ${page}/${PAGE_COUNT}`);
      }

      await delay(REQUEST_DELAY_MS);
    } catch (err) {
      console.warn(`FAILED discover page=${page}: ${err.message}`);
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
