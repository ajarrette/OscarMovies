import { getCachedRating, setCachedRating } from '../utils/ratingCache';

export type LetterboxdFilmData = {
  rating: string | null;
};

export function getLetterboxdCacheKey(tmdbId: string | number) {
  return `letterboxd_${tmdbId}`;
}

export async function getCachedLetterboxdFilmData(tmdbId: string | number) {
  const raw = await getCachedRating(getLetterboxdCacheKey(tmdbId));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LetterboxdFilmData>;
    if (typeof parsed?.rating === 'string' || parsed?.rating === null) {
      return { rating: parsed.rating ?? null };
    }
  } catch {
    // Backward compatibility: old cache stored just the rating string.
  }

  return { rating: raw };
}

export async function setCachedLetterboxdFilmData(
  tmdbId: string | number,
  data: LetterboxdFilmData,
) {
  await setCachedRating(getLetterboxdCacheKey(tmdbId), JSON.stringify(data));
}

export const LETTERBOXD_MOVIE_DATA_SCRAPER_JS = `
  (function() {
    function findRating() {
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        const match = jsonLd.innerHTML.match(/"ratingValue":\\s*([\\d.]+)/);
        if (match) return match[1];
      }

      const meta = document.querySelector('meta[name="twitter:data2"]');
      if (meta) {
        const val = meta.getAttribute('content');
        if (val) return val.split(' ')[0];
      }

      return null;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      const score = findRating();
      attempts++;

      if (score || attempts > 15) {
        window.ReactNativeWebView.postMessage(score || 'N/A');
        clearInterval(interval);
      }
    }, 500);
  })();
  true;
`;
