import type { SQLiteDatabase } from 'expo-sqlite';

export type YearMovieItem = {
  id: number;
  title: string;
  posterPath: string | null;
  popularity: number;
};

type YearMovieRow = {
  id: number;
  title: string;
  poster_path: string | null;
  popularity: number | null;
};

export async function getYearMoviesByPopularity(
  db: SQLiteDatabase,
  year: number,
  limit: number,
  offset: number,
): Promise<YearMovieItem[]> {
  const rows = await db.getAllAsync<YearMovieRow>(
    `SELECT m.id,
            m.title,
            m.poster_path,
            m.popularity
     FROM movies m
     WHERE CAST(strftime('%Y', m.release_date) AS INTEGER) = ?
     ORDER BY COALESCE(m.popularity, 0) DESC,
              m.title COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    [year, limit, offset],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    posterPath: row.poster_path,
    popularity: row.popularity ?? 0,
  }));
}
