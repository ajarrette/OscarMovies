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

const selectMovies = db.prepare(`
  SELECT id, tmdb_id FROM movies
  WHERE tmdb_id IS NOT NULL
    AND backdrop_path IS NULL
`);

const updateMovie = db.prepare(`
  UPDATE movies SET
    backdrop_path  = ?,
    original_title = ?,
    overview       = ?,
    popularity     = ?,
    poster_path    = ?,
    release_date   = ?,
    runtime        = ?,
    tagline        = ?,
    director       = ?
  WHERE id = ?
`);

async function fetchMovieData(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} for id ${tmdbId}`);
  return res.json();
}

async function run() {
  const movies = selectMovies.all();
  console.log(`Enriching ${movies.length} movies...`);

  let success = 0;
  let failed = 0;

  for (const movie of movies) {
    try {
      const data = await fetchMovieData(movie.tmdb_id);
      const director =
        data.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null;

      updateMovie.run(
        data.backdrop_path ?? null,
        data.original_title ?? null,
        data.overview ?? null,
        data.popularity ?? null,
        data.poster_path ?? null,
        data.release_date ?? null,
        data.runtime ?? null,
        data.tagline ?? null,
        director,
        movie.id,
      );

      success++;
      if (success % 50 === 0) console.log(`  ${success}/${movies.length}`);

      // Respect TMDB rate limit (~40 req/s to be safe)
      await new Promise((r) => setTimeout(r, 25));
    } catch (err) {
      console.warn(`  FAILED tmdb_id=${movie.tmdb_id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Done. ${success} updated, ${failed} failed.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
