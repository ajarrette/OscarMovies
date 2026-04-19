type Film = {
  backdrop_path: string;
  director: string;
  film_rating: number | null;
  genres?: string[];
  id: number;
  tmdb_id: number;
  imdb_id: string;
  imdb_rating: number | null;
  letterboxd_rating: number | null;
  nominations: number;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: number;
  runtime: number;
  tagline: string;
  title: string;
  wins: number;
};

export default Film;
