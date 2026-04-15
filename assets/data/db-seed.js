#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..', '..');
const JSON_SRC = path.join(ROOT, 'assets', 'data', 'oscar-nominations.json');
const DB_OUT = path.join(ROOT, 'assets', 'data', 'oscar-movies.db');

// ── Clean start ───────────────────────────────────────────────────────────────
if (fs.existsSync(DB_OUT)) fs.unlinkSync(DB_OUT);
const db = new Database(DB_OUT);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE ceremonies (
    id         INTEGER PRIMARY KEY,
    year_label TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE categories (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE movies (
    id           INTEGER PRIMARY KEY,
    title        TEXT    NOT NULL,
    tmdb_id      INTEGER UNIQUE,
    imdb_id      TEXT    UNIQUE,
    wins         INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    nominations  INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0)
  );

  CREATE TABLE people (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE nominations (
    id           INTEGER PRIMARY KEY,
    ceremony_id  INTEGER NOT NULL,
    category_id  INTEGER NOT NULL,
    won          INTEGER NOT NULL CHECK (won IN (0, 1)),
    source_order INTEGER,
    FOREIGN KEY (ceremony_id) REFERENCES ceremonies(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE nomination_movies (
    nomination_id INTEGER NOT NULL,
    movie_id      INTEGER NOT NULL,
    ordinal       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (nomination_id, movie_id),
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id)      REFERENCES movies(id)      ON DELETE CASCADE
  );

  CREATE TABLE nomination_people (
    nomination_id INTEGER NOT NULL,
    person_id     INTEGER NOT NULL,
    ordinal       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (nomination_id, person_id),
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id)     REFERENCES people(id)      ON DELETE CASCADE
  );

  CREATE TABLE nomination_nominees (
    id            INTEGER PRIMARY KEY,
    nomination_id INTEGER NOT NULL,
    nominee_text  TEXT    NOT NULL,
    nominee_kind  TEXT    NOT NULL DEFAULT 'unknown'
      CHECK (nominee_kind IN ('person','movie','song','other','unknown')),
    ordinal       INTEGER NOT NULL,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_nominations_ceremony_category ON nominations(ceremony_id, category_id);
  CREATE INDEX idx_nomination_movies_movie        ON nomination_movies(movie_id);
  CREATE INDEX idx_nomination_people_person       ON nomination_people(person_id);
  CREATE INDEX idx_nomination_nominees_nomination ON nomination_nominees(nomination_id);
`);

// ── Prepared statements ───────────────────────────────────────────────────────
const stmts = {
  insertCeremony: db.prepare(
    'INSERT OR IGNORE INTO ceremonies (year_label) VALUES (?)',
  ),
  getCeremony: db.prepare('SELECT id FROM ceremonies WHERE year_label = ?'),

  insertCategory: db.prepare(
    'INSERT OR IGNORE INTO categories (name) VALUES (?)',
  ),
  getCategory: db.prepare('SELECT id FROM categories WHERE name = ?'),

  insertMovie: db.prepare(`
    INSERT OR IGNORE INTO movies (title, tmdb_id, imdb_id) VALUES (?, ?, ?)
  `),
  getMovieByTmdb: db.prepare('SELECT id FROM movies WHERE tmdb_id = ?'),
  getMovieByImdb: db.prepare('SELECT id FROM movies WHERE imdb_id = ?'),
  getMovieByTitle: db.prepare(
    'SELECT id FROM movies WHERE title = ? AND tmdb_id IS NULL AND imdb_id IS NULL',
  ),

  insertPerson: db.prepare('INSERT OR IGNORE INTO people (name) VALUES (?)'),
  getPerson: db.prepare('SELECT id FROM people WHERE name = ?'),

  insertNomination: db.prepare(`
    INSERT INTO nominations (ceremony_id, category_id, won, source_order)
    VALUES (?, ?, ?, ?)
  `),

  insertNomMovie: db.prepare(`
    INSERT OR IGNORE INTO nomination_movies (nomination_id, movie_id, ordinal)
    VALUES (?, ?, ?)
  `),
  insertNomPerson: db.prepare(`
    INSERT OR IGNORE INTO nomination_people (nomination_id, person_id, ordinal)
    VALUES (?, ?, ?)
  `),
  insertNomNominee: db.prepare(`
    INSERT INTO nomination_nominees (nomination_id, nominee_text, nominee_kind, ordinal)
    VALUES (?, ?, ?, ?)
  `),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns 'movie'  when every nominee string matches a title in the movies array
 *         'song'   when the category name contains "song"
 *         'person' for actors, directors, technicians, composers, etc.
 */
function classifyNomineeKind(category, nominees, movies) {
  if (category.toLowerCase().includes('song')) return 'song';

  if (movies.length > 0 && nominees.length > 0) {
    const titles = new Set(movies.map((m) => m.title));
    if (nominees.every((n) => titles.has(n))) return 'movie';
  }

  return 'person';
}

/**
 * Resolves the movies table id for a movie object from the JSON.
 * Prefers tmdb_id → imdb_id → title fallback.
 */
function resolveMovieId(m) {
  if (m.tmdb_id != null) {
    const row = stmts.getMovieByTmdb.get(m.tmdb_id);
    if (row) return row.id;
  }
  if (m.imdb_id) {
    const row = stmts.getMovieByImdb.get(m.imdb_id);
    if (row) return row.id;
  }
  return stmts.getMovieByTitle.get(m.title)?.id ?? null;
}

// ── Seed ──────────────────────────────────────────────────────────────────────
const records = JSON.parse(fs.readFileSync(JSON_SRC, 'utf8'));

const seed = db.transaction(() => {
  records.forEach((rec, sourceOrder) => {
    // ceremonies + categories (upsert via INSERT OR IGNORE)
    stmts.insertCeremony.run(rec.year);
    const ceremony = stmts.getCeremony.get(rec.year);

    stmts.insertCategory.run(rec.category);
    const category = stmts.getCategory.get(rec.category);

    // movies (upsert to deduplicate across nominations)
    for (const m of rec.movies) {
      stmts.insertMovie.run(m.title, m.tmdb_id ?? null, m.imdb_id ?? null);
    }

    // core nomination row
    const { lastInsertRowid: nominationId } = stmts.insertNomination.run(
      ceremony.id,
      category.id,
      rec.won ? 1 : 0,
      sourceOrder,
    );

    // nomination → movies join
    rec.movies.forEach((m, i) => {
      const movieId = resolveMovieId(m);
      if (movieId != null) {
        stmts.insertNomMovie.run(nominationId, movieId, i + 1);
      }
    });

    // classify nominee strings and store them
    const kind = classifyNomineeKind(rec.category, rec.nominees, rec.movies);

    rec.nominees.forEach((name, i) => {
      stmts.insertNomNominee.run(nominationId, name, kind, i + 1);

      if (kind === 'person') {
        stmts.insertPerson.run(name);
        const person = stmts.getPerson.get(name);
        stmts.insertNomPerson.run(nominationId, person.id, i + 1);
      }
    });
  });
});

seed();

// ── Compute wins / nominations from the final linked data ─────────────────────
db.exec(`
  UPDATE movies
  SET
    nominations = (
      SELECT COUNT(DISTINCT nm.nomination_id)
      FROM nomination_movies nm
      WHERE nm.movie_id = movies.id
    ),
    wins = (
      SELECT COUNT(DISTINCT nm.nomination_id)
      FROM nomination_movies nm
      JOIN nominations n ON n.id = nm.nomination_id
      WHERE nm.movie_id = movies.id
        AND n.won = 1
    );
`);

// ── Summary ───────────────────────────────────────────────────────────────────
const counts = {
  ceremonies: db.prepare('SELECT COUNT(*) AS n FROM ceremonies').get().n,
  categories: db.prepare('SELECT COUNT(*) AS n FROM categories').get().n,
  movies: db.prepare('SELECT COUNT(*) AS n FROM movies').get().n,
  people: db.prepare('SELECT COUNT(*) AS n FROM people').get().n,
  nominations: db.prepare('SELECT COUNT(*) AS n FROM nominations').get().n,
};

console.log('✓ Seeded', DB_OUT);
console.table(counts);

db.close();
