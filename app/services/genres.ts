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
};

type GenreNameRow = {
  name: string;
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
  const rows = await db.getAllAsync<GenreMovieRow>(
    `SELECT m.id,
            m.title,
            m.poster_path,
            m.popularity
     FROM movie_tmdb_genres mg
     INNER JOIN movies m ON m.id = mg.movie_id
     WHERE mg.genre_id = ?
     ORDER BY COALESCE(m.popularity, 0) DESC,
              m.title COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    [genreId, limit, offset],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    posterPath: row.poster_path,
    popularity: row.popularity ?? 0,
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
