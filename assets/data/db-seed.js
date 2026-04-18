#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { normalizeNameForComparison } = require('./name-normalization');

const ROOT = path.join(__dirname, '..', '..');
const JSON_SRC = path.join(ROOT, 'assets', 'data', 'oscar-nominations.json');
const DB_OUT = path.join(ROOT, 'assets', 'data', 'oscar-movies.db');

// ── Open existing DB or create if missing ─────────────────────────────────────
const db = new Database(DB_OUT);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ceremonies (
    id         INTEGER PRIMARY KEY,
    year_label TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS movies (
    id            INTEGER PRIMARY KEY,
    title         TEXT    NOT NULL,
    tmdb_id       INTEGER UNIQUE,
    imdb_id       TEXT    UNIQUE,
    backdrop_path TEXT,
    original_title TEXT,
    overview      TEXT,
    popularity    REAL,
    poster_path   TEXT,
    release_date  TEXT,
    runtime       INTEGER,
    tagline       TEXT,
    imdb_rating   REAL,
    letterboxd_rating REAL,
    film_rating   REAL,
    imdb_rating_last_fetched TEXT,
    letterbox_rating_last_fetched TEXT,
    director      TEXT,
    wins          INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    nominations   INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0)
  );

  CREATE TABLE IF NOT EXISTS people (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE,
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    nominations INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0)
  );

  CREATE TABLE IF NOT EXISTS nominations (
    id           INTEGER PRIMARY KEY,
    ceremony_id  INTEGER NOT NULL,
    category_id  INTEGER NOT NULL,
    won          INTEGER NOT NULL CHECK (won IN (0, 1)),
    source_order INTEGER,
    FOREIGN KEY (ceremony_id) REFERENCES ceremonies(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS nomination_movies (
    nomination_id INTEGER NOT NULL,
    movie_id      INTEGER NOT NULL,
    ordinal       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (nomination_id, movie_id),
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id)      REFERENCES movies(id)      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS nomination_people (
    nomination_id INTEGER NOT NULL,
    person_id     INTEGER NOT NULL,
    ordinal       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (nomination_id, person_id),
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id)     REFERENCES people(id)      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS nomination_nominees (
    id            INTEGER PRIMARY KEY,
    nomination_id INTEGER NOT NULL,
    nominee_text  TEXT    NOT NULL,
    nominee_kind  TEXT    NOT NULL DEFAULT 'unknown'
      CHECK (nominee_kind IN ('person','movie','song','other','unknown')),
    ordinal       INTEGER NOT NULL,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_nominations_ceremony_category ON nominations(ceremony_id, category_id);
  CREATE INDEX IF NOT EXISTS idx_nomination_movies_movie        ON nomination_movies(movie_id);
  CREATE INDEX IF NOT EXISTS idx_nomination_people_person       ON nomination_people(person_id);
  CREATE INDEX IF NOT EXISTS idx_nomination_people_person_nomination
    ON nomination_people(person_id, nomination_id);
  CREATE INDEX IF NOT EXISTS idx_nomination_movies_nomination_ordinal_movie
    ON nomination_movies(nomination_id, ordinal, movie_id);
  CREATE INDEX IF NOT EXISTS idx_nomination_nominees_nomination ON nomination_nominees(nomination_id);
  CREATE INDEX IF NOT EXISTS idx_nominations_source_order       ON nominations(source_order);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_nomination_nominees_unique
    ON nomination_nominees(nomination_id, ordinal);
`);

const existingMovieColumns = db
  .prepare('PRAGMA table_info(movies)')
  .all()
  .map((column) => column.name);

if (!existingMovieColumns.includes('imdb_rating')) {
  db.prepare('ALTER TABLE movies ADD COLUMN imdb_rating REAL').run();
}

if (!existingMovieColumns.includes('letterboxd_rating')) {
  db.prepare('ALTER TABLE movies ADD COLUMN letterboxd_rating REAL').run();
}

if (!existingMovieColumns.includes('film_rating')) {
  db.prepare('ALTER TABLE movies ADD COLUMN film_rating REAL').run();
}

if (!existingMovieColumns.includes('imdb_rating_last_fetched')) {
  db.prepare(
    'ALTER TABLE movies ADD COLUMN imdb_rating_last_fetched TEXT',
  ).run();
}

if (!existingMovieColumns.includes('letterbox_rating_last_fetched')) {
  db.prepare(
    'ALTER TABLE movies ADD COLUMN letterbox_rating_last_fetched TEXT',
  ).run();
}

// Keep older DB files compatible by adding stats columns if they do not exist.
const existingPeopleColumns = db
  .prepare('PRAGMA table_info(people)')
  .all()
  .map((column) => column.name);

if (!existingPeopleColumns.includes('wins')) {
  db.prepare(
    'ALTER TABLE people ADD COLUMN wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0)',
  ).run();
}

if (!existingPeopleColumns.includes('nominations')) {
  db.prepare(
    'ALTER TABLE people ADD COLUMN nominations INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0)',
  ).run();
}

if (existingPeopleColumns.includes('known_for_department')) {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_people_department_name_nocase ON people(known_for_department, name COLLATE NOCASE)',
  ).run();
}

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
  getNominationBySourceOrder: db.prepare(
    'SELECT id FROM nominations WHERE source_order = ?',
  ),

  insertNomMovie: db.prepare(`
    INSERT OR IGNORE INTO nomination_movies (nomination_id, movie_id, ordinal)
    VALUES (?, ?, ?)
  `),
  insertNomPerson: db.prepare(`
    INSERT OR IGNORE INTO nomination_people (nomination_id, person_id, ordinal)
    VALUES (?, ?, ?)
  `),
  insertNomNominee: db.prepare(`
    INSERT OR IGNORE INTO nomination_nominees (nomination_id, nominee_text, nominee_kind, ordinal)
    VALUES (?, ?, ?, ?)
  `),
  selectPeople: db.prepare('SELECT id, name FROM people'),
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
const personIdByNormalizedName = new Map(
  stmts.selectPeople
    .all()
    .map((person) => [normalizeNameForComparison(person.name), person.id])
    .filter(([normalized]) => normalized !== ''),
);

const seed = db.transaction(() => {
  records.forEach((rec, sourceOrder) => {
    // ceremonies + categories (upsert via INSERT OR IGNORE)
    stmts.insertCeremony.run(rec.year);
    const ceremony = stmts.getCeremony.get(rec.year);

    stmts.insertCategory.run(rec.category);
    const category = stmts.getCategory.get(rec.category);

    // movies (upsert to deduplicate across nominations)
    for (const m of rec.movies) {
      stmts.insertMovie.run(
        m.title,
        m.tmdb_id ?? null,
        m.imdb_id ?? null,
        m.backdrop_path ?? null,
        m.original_title ?? null,
        m.overview ?? null,
        m.popularity ?? null,
        m.poster_path ?? null,
        m.release_date ?? null,
        m.runtime ?? null,
        m.tagline ?? null,
        m.director ?? null,
      );
    }

    // core nomination row
    let nominationId = stmts.getNominationBySourceOrder.get(sourceOrder)?.id;
    if (nominationId == null) {
      const inserted = stmts.insertNomination.run(
        ceremony.id,
        category.id,
        rec.won ? 1 : 0,
        sourceOrder,
      );
      nominationId = Number(inserted.lastInsertRowid);
    }

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
        const normalizedName = normalizeNameForComparison(name);
        let personId =
          normalizedName === ''
            ? null
            : (personIdByNormalizedName.get(normalizedName) ?? null);

        if (personId == null) {
          stmts.insertPerson.run(name);
          const person = stmts.getPerson.get(name);
          if (!person) {
            throw new Error(`Failed to resolve person id for nominee: ${name}`);
          }

          personId = person.id;
          if (normalizedName !== '') {
            personIdByNormalizedName.set(normalizedName, personId);
          }
        }

        stmts.insertNomPerson.run(nominationId, personId, i + 1);
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

  UPDATE people
  SET
    nominations = (
      SELECT COUNT(*)
      FROM nomination_people np
      WHERE np.person_id = people.id
    ),
    wins = (
      SELECT COUNT(*)
      FROM nomination_people np
      JOIN nominations n ON n.id = np.nomination_id
      WHERE np.person_id = people.id
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
