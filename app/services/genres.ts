import type { SQLiteDatabase } from 'expo-sqlite';

export type GenreListItem = {
  id: number;
  name: string;
  movieCount: number;
};

export type GenreMovieItem = {
  id: number;
  title: string;
  posterPath: string | null;
  popularity: number;
  wins: number;
  nominations: number;
};

export type GenreAdjacentMovieIds = {
  previousId: number | null;
  nextId: number | null;
};

type GenreListRow = {
  id: number;
  name: string;
  movie_count: number;
};

type GenreMovieRow = {
  id: number;
  title: string;
  poster_path: string | null;
  popularity: number | null;
  wins: number | null;
  nominations: number | null;
};

type GenreNameRow = {
  name: string;
};

type GenreAdjacentRow = {
  previousId: number | null;
  nextId: number | null;
};

export async function getGenresWithMovieCounts(
  db: SQLiteDatabase,
): Promise<GenreListItem[]> {
  const rows = await db.getAllAsync<GenreListRow>(
    `SELECT g.id,
            g.name,
            COUNT(mg.movie_id) AS movie_count
     FROM tmdb_genres g
     INNER JOIN movie_tmdb_genres mg ON mg.genre_id = g.id
     GROUP BY g.id, g.name
     HAVING COUNT(mg.movie_id) > 0
     ORDER BY g.name COLLATE NOCASE ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    movieCount: row.movie_count,
  }));
}

export async function getGenreMoviesByPopularity(
  db: SQLiteDatabase,
  genreId: number,
  limit: number,
  offset: number,
): Promise<GenreMovieItem[]> {
  const rows =
    genreId > 0
      ? await db.getAllAsync<GenreMovieRow>(
          `SELECT m.id,
                  m.title,
                  m.poster_path,
                  m.popularity,
                  COALESCE(m.wins, 0) AS wins,
                  COALESCE(m.nominations, 0) AS nominations
           FROM movie_tmdb_genres mg
           INNER JOIN movies m ON m.id = mg.movie_id
           WHERE mg.genre_id = ?
           ORDER BY COALESCE(m.popularity, 0) DESC,
                    m.title COLLATE NOCASE ASC
           LIMIT ? OFFSET ?`,
          [genreId, limit, offset],
        )
      : await db.getAllAsync<GenreMovieRow>(
          `SELECT m.id,
                  m.title,
                  m.poster_path,
                  m.popularity,
                  COALESCE(m.wins, 0) AS wins,
                  COALESCE(m.nominations, 0) AS nominations
           FROM movies m
           ORDER BY COALESCE(m.popularity, 0) DESC,
                    m.title COLLATE NOCASE ASC
           LIMIT ? OFFSET ?`,
          [limit, offset],
        );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    posterPath: row.poster_path,
    popularity: row.popularity ?? 0,
    wins: row.wins ?? 0,
    nominations: row.nominations ?? 0,
  }));
}

export async function getGenreNameById(
  db: SQLiteDatabase,
  genreId: number,
): Promise<string | null> {
  const row = await db.getFirstAsync<GenreNameRow>(
    'SELECT name FROM tmdb_genres WHERE id = ? LIMIT 1',
    [genreId],
  );

  return row?.name ?? null;
}

export async function getGenreAdjacentMovieIds(
  db: SQLiteDatabase,
  genreId: number,
  movieId: number,
): Promise<GenreAdjacentMovieIds | null> {
  const row =
    genreId > 0
      ? await db.getFirstAsync<GenreAdjacentRow>(
          `WITH ordered_movies AS (
            SELECT
              m.id,
              ROW_NUMBER() OVER (
                ORDER BY
                  COALESCE(m.popularity, 0) DESC,
                  m.title COLLATE NOCASE ASC,
                  m.id ASC
              ) AS row_num
            FROM movie_tmdb_genres mg
            INNER JOIN movies m ON m.id = mg.movie_id
            WHERE mg.genre_id = ?
          ),
          current_movie AS (
            SELECT row_num
            FROM ordered_movies
            WHERE id = ?
            LIMIT 1
          )
          SELECT
            (
              SELECT id
              FROM ordered_movies
              WHERE row_num = current_movie.row_num - 1
            ) AS previousId,
            (
              SELECT id
              FROM ordered_movies
              WHERE row_num = current_movie.row_num + 1
            ) AS nextId
          FROM current_movie`,
          [genreId, movieId],
        )
      : await db.getFirstAsync<GenreAdjacentRow>(
          `WITH ordered_movies AS (
            SELECT
              m.id,
              ROW_NUMBER() OVER (
                ORDER BY
                  COALESCE(m.popularity, 0) DESC,
                  m.title COLLATE NOCASE ASC,
                  m.id ASC
              ) AS row_num
            FROM movies m
          ),
          current_movie AS (
            SELECT row_num
            FROM ordered_movies
            WHERE id = ?
            LIMIT 1
          )
          SELECT
            (
              SELECT id
              FROM ordered_movies
              WHERE row_num = current_movie.row_num - 1
            ) AS previousId,
            (
              SELECT id
              FROM ordered_movies
              WHERE row_num = current_movie.row_num + 1
            ) AS nextId
          FROM current_movie`,
          [movieId],
        );

  if (!row) {
    return null;
  }

  return {
    previousId: row.previousId ?? null,
    nextId: row.nextId ?? null,
  };
}
