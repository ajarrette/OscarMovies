import { getCachedRating, setCachedRating } from '../utils/ratingCache';

export interface OmdbRatingEntry {
  source: string;
  value: string;
}

export interface OmdbRatingsData {
  title: string;
  year: string;
  poster: string;
  rated: string;
  tomatoURL: string;
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
  Rated: string;
  tomatoURL?: string;
  Ratings: OmdbApiRatingEntry[];
  imdbRating: string;
  Response?: string;
  Error?: string;
};

class OmdbServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NETWORK'
      | 'TIMEOUT'
      | 'HTTP'
      | 'INVALID_RESPONSE'
      | 'NOT_FOUND',
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'OmdbServiceError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const OMDB_FETCH_TIMEOUT_MS = 10000;
const OMDB_MAX_RETRY_ATTEMPTS = 3;
const OMDB_RETRY_DELAYS_MS = [350, 900];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryOmdbError(error: OmdbServiceError): boolean {
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') {
    return true;
  }

  if (error.code === 'HTTP') {
    const statusMatch = error.message.match(/OMDb HTTP\s+(\d+)/);
    const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : 0;
    return status === 429 || status >= 500;
  }

  return false;
}

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
    rated: String(record.Rated ?? record.rated ?? 'N/A'),
    tomatoURL: String(record.tomatoURL ?? ''),
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

  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}&tomatoes=true`;

  try {
    let lastError: OmdbServiceError | null = null;

    for (let attempt = 1; attempt <= OMDB_MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          OMDB_FETCH_TIMEOUT_MS,
        );

        let response: Response;
        try {
          response = await fetch(url, { signal: controller.signal });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new OmdbServiceError(
              'OMDb request timed out',
              'TIMEOUT',
              `imdbId=${imdbId}`,
            );
          }

          throw new OmdbServiceError(
            'Network error while fetching OMDb data',
            'NETWORK',
            extractErrorMessage(error),
          );
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          throw new OmdbServiceError(
            `OMDb HTTP ${response.status}`,
            'HTTP',
            response.statusText,
          );
        }

        let rawResult: unknown;
        try {
          rawResult = await response.json();
        } catch (error) {
          throw new OmdbServiceError(
            'OMDb returned invalid JSON',
            'INVALID_RESPONSE',
            extractErrorMessage(error),
          );
        }

        if (!isRecord(rawResult)) {
          throw new OmdbServiceError(
            'OMDb returned a non-object response',
            'INVALID_RESPONSE',
          );
        }

        const result = rawResult as OmdbApiResponse;

        if (result.Response === 'False') {
          const errorMessage = result.Error || 'Movie not found';
          const code =
            errorMessage === 'Movie not found!'
              ? 'NOT_FOUND'
              : 'INVALID_RESPONSE';
          throw new OmdbServiceError(errorMessage, code, `imdbId=${imdbId}`);
        }

        const normalizedData = normalizeOmdbRatingsData(result);

        if (!normalizedData.title && !normalizedData.imdbRatingValue) {
          throw new OmdbServiceError(
            'OMDb response missing expected rating fields',
            'INVALID_RESPONSE',
            `imdbId=${imdbId}`,
          );
        }

        await setCachedRating(cacheKey, JSON.stringify(normalizedData));
        return normalizedData;
      } catch (error) {
        if (!(error instanceof OmdbServiceError)) {
          throw error;
        }

        lastError = error;
        const canRetry =
          attempt < OMDB_MAX_RETRY_ATTEMPTS && shouldRetryOmdbError(error);

        if (!canRetry) {
          throw error;
        }

        const retryDelay = OMDB_RETRY_DELAYS_MS[attempt - 1] ?? 1200;
        console.warn(
          `OMDb fetch attempt ${attempt} failed (${error.code}); retrying in ${retryDelay}ms`,
          error.details ?? '',
        );
        await delay(retryDelay);
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  } catch (error) {
    if (error instanceof OmdbServiceError) {
      if (error.code === 'NOT_FOUND') {
        console.info('OMDb has no listing for imdb id:', imdbId);
      } else {
        console.warn(
          `OMDb fetch failed (${error.code}): ${error.message}`,
          error.details ?? '',
        );
      }

      return null;
    }

    console.error('Unexpected error fetching OMDb data:', error);
    return null;
  }
}

export default function OmdbRatingsServiceRoute(): null {
  return null;
}
