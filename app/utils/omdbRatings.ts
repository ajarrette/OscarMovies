import { useEffect, useState } from 'react';
import {
  fetchOmdbRatingsByImdbId,
  OmdbRatingsData,
} from '../services/omdb-rating-service';

type UseOmdbRatingsResult = {
  omdbRatingsData: OmdbRatingsData | null;
  isOmdbLoading: boolean;
};

export function useOmdbRatings(imdbId?: string | null): UseOmdbRatingsResult {
  const [omdbRatingsData, setOmdbRatingsData] =
    useState<OmdbRatingsData | null>(null);
  const [isOmdbLoading, setIsOmdbLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadOmdbRatingsData = async () => {
      if (!imdbId) {
        if (isMounted) {
          setOmdbRatingsData(null);
          setIsOmdbLoading(false);
        }
        return;
      }

      setIsOmdbLoading(true);
      const data = await fetchOmdbRatingsByImdbId(imdbId);

      if (isMounted) {
        setOmdbRatingsData(data);
        setIsOmdbLoading(false);
      }
    };

    loadOmdbRatingsData();

    return () => {
      isMounted = false;
    };
  }, [imdbId]);

  return { omdbRatingsData, isOmdbLoading };
}

export function getFilmRatingLabel(
  omdbRatingsData: OmdbRatingsData | null,
  isOmdbLoading: boolean,
): string {
  if (isOmdbLoading) {
    return 'Loading...';
  }

  return omdbRatingsData?.rated || 'N/A';
}

export function getOmdbSourceRatingValue(
  omdbRatingsData: OmdbRatingsData | null,
  source: string,
): string | null {
  return (
    omdbRatingsData?.ratings.find((rating) => rating.source === source)
      ?.value ?? null
  );
}

export function getImdbDisplayRating(
  omdbRatingsData: OmdbRatingsData | null,
  isOmdbLoading: boolean,
): string {
  if (isOmdbLoading) {
    return 'Loading...';
  }

  if (
    !omdbRatingsData?.imdbRatingValue ||
    omdbRatingsData.imdbRatingValue === 'N/A'
  ) {
    return 'No rating';
  }

  return `${omdbRatingsData.imdbRatingValue}/10`;
}

export function getOmdbDisplayRating(
  ratingValue: string | null,
  isOmdbLoading: boolean,
): string {
  if (isOmdbLoading) {
    return 'Loading...';
  }

  return ratingValue || 'No rating';
}

export function isRottenTomatoesRatingRotten(
  rottenTomatoesValue: string | null,
): boolean {
  if (!rottenTomatoesValue) {
    return false;
  }

  const match = rottenTomatoesValue.match(/(\d+)/);
  if (!match) {
    return false;
  }

  return Number.parseInt(match[1], 10) < 60;
}

export function shouldUseRottenTomatoesRating(
  rottenTomatoesValue: string | null,
  isOmdbLoading: boolean,
): boolean {
  if (isOmdbLoading) {
    return true;
  }

  return Boolean(rottenTomatoesValue);
}
