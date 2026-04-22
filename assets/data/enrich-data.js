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
`);

const updateMovie = db.prepare(`
  UPDATE movies SET
    backdrop_path  = ?,
    original_title = ?,
    overview       = ?,
    poster_path    = ?,
    release_date   = ?,
    runtime        = ?,
    tagline        = ?,
    director       = ?
  WHERE id = ?
`);

const upsertGenre = db.prepare(`
  INSERT INTO tmdb_genres (id, name)
  VALUES (?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name
`);

const clearMovieGenres = db.prepare(
  'DELETE FROM movie_tmdb_genres WHERE movie_id = ?',
);

const linkMovieGenre = db.prepare(`
  INSERT OR IGNORE INTO movie_tmdb_genres (movie_id, genre_id)
  VALUES (?, ?)
`);

const upsertProductionCompany = db.prepare(`
  INSERT INTO tmdb_production_companies (id, name, logo_path, origin_country)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    logo_path = excluded.logo_path,
    origin_country = excluded.origin_country
`);

const clearMovieProductionCompanies = db.prepare(
  'DELETE FROM movie_tmdb_production_companies WHERE movie_id = ?',
);

const linkMovieProductionCompany = db.prepare(`
  INSERT OR IGNORE INTO movie_tmdb_production_companies (movie_id, company_id)
  VALUES (?, ?)
`);

const upsertSpokenLanguage = db.prepare(`
  INSERT INTO tmdb_spoken_languages (iso_639_1, english_name, name)
  VALUES (?, ?, ?)
  ON CONFLICT(iso_639_1) DO UPDATE SET
    english_name = excluded.english_name,
    name = excluded.name
`);

const clearMovieSpokenLanguages = db.prepare(
  'DELETE FROM movie_tmdb_spoken_languages WHERE movie_id = ?',
);

const linkMovieSpokenLanguage = db.prepare(`
  INSERT OR IGNORE INTO movie_tmdb_spoken_languages (movie_id, language_code)
  VALUES (?, ?)
`);

const enrichMovie = db.transaction((movieId, data, director) => {
  updateMovie.run(
    data.backdrop_path ?? null,
    data.original_title ?? null,
    data.overview ?? null,
    data.poster_path ?? null,
    data.release_date ?? null,
    data.runtime ?? null,
    data.tagline ?? null,
    director,
    movieId,
  );

  clearMovieGenres.run(movieId);
  const genres = Array.isArray(data.genres) ? data.genres : [];
  for (const genre of genres) {
    if (genre?.id == null) continue;
    upsertGenre.run(genre.id, genre.name ?? 'Unknown');
    linkMovieGenre.run(movieId, genre.id);
  }

  clearMovieProductionCompanies.run(movieId);
  const productionCompanies = Array.isArray(data.production_companies)
    ? data.production_companies
    : [];
  for (const company of productionCompanies) {
    if (company?.id == null) continue;
    upsertProductionCompany.run(
      company.id,
      company.name ?? 'Unknown',
      company.logo_path ?? null,
      company.origin_country ?? null,
    );
    linkMovieProductionCompany.run(movieId, company.id);
  }

  clearMovieSpokenLanguages.run(movieId);
  const spokenLanguages = Array.isArray(data.spoken_languages)
    ? data.spoken_languages
    : [];
  for (const language of spokenLanguages) {
    if (!language?.iso_639_1) continue;
    upsertSpokenLanguage.run(
      language.iso_639_1,
      language.english_name ?? null,
      language.name ?? null,
    );
    linkMovieSpokenLanguage.run(movieId, language.iso_639_1);
  }
});

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

      enrichMovie(movie.id, data, director);

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
