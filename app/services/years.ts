import type { SQLiteDatabase } from 'expo-sqlite';
import { ensurePopularityCacheFresh } from './popularity';

export type YearMovieItem = {
  id: number;
  title: string;
  posterPath: string | null;
  popularity: number;
  wins: number;
  nominations: number;
};

export type YearAdjacentMovieIds = {
  previousId: number | null;
  nextId: number | null;
};

type YearMovieRow = {
  id: number;
  title: string;
  poster_path: string | null;
  popularity: number | null;
  wins: number | null;
  nominations: number | null;
};

type YearAdjacentRow = {
  previousId: number | null;
  nextId: number | null;
};

export async function getYearMoviesByPopularity(
  db: SQLiteDatabase,
  year: number,
  limit: number,
  offset: number,
): Promise<YearMovieItem[]> {
  await ensurePopularityCacheFresh(db, 'movie');

  const rows = await db.getAllAsync<YearMovieRow>(
    `SELECT m.id,
            m.title,
            m.poster_path,
            COALESCE(mpc.popularity, 0) AS popularity,
            COALESCE(m.wins, 0) AS wins,
            COALESCE(m.nominations, 0) AS nominations
     FROM movies m
     LEFT JOIN movie_popularity_cache mpc ON mpc.tmdb_id = m.tmdb_id
     WHERE CAST(strftime('%Y', m.release_date) AS INTEGER) = ?
     ORDER BY COALESCE(mpc.popularity, 0) DESC,
              COALESCE(m.nominations, 0) DESC,
              m.title COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    [year, limit, offset],
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

export async function getYearAdjacentMovieIds(
  db: SQLiteDatabase,
  year: number,
  movieId: number,
): Promise<YearAdjacentMovieIds | null> {
  await ensurePopularityCacheFresh(db, 'movie');

  const row = await db.getFirstAsync<YearAdjacentRow>(
    `WITH ordered_movies AS (
      SELECT
        m.id,
        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(mpc.popularity, 0) DESC,
            COALESCE(m.nominations, 0) DESC,
            m.title COLLATE NOCASE ASC,
            m.id ASC
        ) AS row_num
      FROM movies m
      LEFT JOIN movie_popularity_cache mpc ON mpc.tmdb_id = m.tmdb_id
      WHERE CAST(strftime('%Y', m.release_date) AS INTEGER) = ?
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
    [year, movieId],
  );

  if (!row) {
    return null;
  }

  return {
    previousId: row.previousId ?? null,
    nextId: row.nextId ?? null,
  };
}
