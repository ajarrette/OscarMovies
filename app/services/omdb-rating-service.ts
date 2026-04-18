import { getCachedRating, setCachedRating } from '../utils/ratingCache';

export interface OmdbRatingEntry {
  source: string;
  value: string;
}

export interface OmdbRatingsData {
  title: string;
  year: string;
  poster: string;
  ratings: OmdbRatingEntry[];
  imdbRatingValue: string;
}

type OmdbApiRatingEntry = {
  Source: string;
  Value: string;
};

type OmdbApiResponse = {
  Title: string;
  Year: string;
  Poster: string;
  Ratings: OmdbApiRatingEntry[];
  imdbRating: string;
  Response?: string;
  Error?: string;
};

function normalizeOmdbRatingsData(raw: unknown): OmdbRatingsData {
  const record = raw as Record<string, unknown>;
  const rawRatings = Array.isArray(record.Ratings)
    ? (record.Ratings as Record<string, unknown>[])
    : Array.isArray(record.ratings)
      ? (record.ratings as Record<string, unknown>[])
      : [];

  return {
    title: String(record.Title ?? record.title ?? ''),
    year: String(record.Year ?? record.year ?? ''),
    poster: String(record.Poster ?? record.poster ?? ''),
    ratings: rawRatings.map((rating) => ({
      source: String(rating.Source ?? rating.source ?? ''),
      value: String(rating.Value ?? rating.value ?? ''),
    })),
    imdbRatingValue: String(record.imdbRatingValue ?? record.imdbRating ?? ''),
  };
}

export async function fetchOmdbRatingsByImdbId(
  imdbId: string,
): Promise<OmdbRatingsData | null> {
  if (!imdbId) {
    return null;
  }

  const cacheKey = `omdb_${imdbId}`;
  const cachedData = await getCachedRating(cacheKey);

  if (cachedData) {
    try {
      return normalizeOmdbRatingsData(JSON.parse(cachedData));
    } catch (error) {
      console.error('Error parsing cached OMDb data:', error);
    }
  }

  const apiKey = process.env.EXPO_PUBLIC_OMDB_API_KEY;
  if (!apiKey) {
    console.error('Missing EXPO_PUBLIC_OMDB_API_KEY for OMDb request');
    return null;
  }

  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const result = (await response.json()) as OmdbApiResponse;

    if (result.Response === 'False') {
      throw new Error(result.Error || 'Movie not found');
    }

    const normalizedData = normalizeOmdbRatingsData(result);
    await setCachedRating(cacheKey, JSON.stringify(normalizedData));
    return normalizedData;
  } catch (error) {
    console.error('Error fetching OMDb data:', error);
    return null;
  }
}

export default function OmdbRatingsServiceRoute(): null {
  return null;
}
