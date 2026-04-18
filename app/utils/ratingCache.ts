import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache timeout: 1 week in milliseconds
 * Adjust this value to change the cache expiration time
 */
export const RATING_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

interface CachedRating {
  value: string;
  timestamp: number;
}

/**
 * Get a cached rating if it exists and hasn't expired
 * @param key Cache key (e.g., "letterboxd_1491")
 * @returns Cached rating string, or null if not found or expired
 */
export async function getCachedRating(key: string): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const data: CachedRating = JSON.parse(cached);
    const now = Date.now();

    // Check if cache has expired
    if (now - data.timestamp > RATING_CACHE_TTL) {
      // Cache expired, remove it
      await AsyncStorage.removeItem(key);
      return null;
    }

    return data.value;
  } catch (err) {
    console.error(`Error reading cache for ${key}:`, err);
    return null;
  }
}

/**
 * Store a rating in cache with current timestamp
 * @param key Cache key (e.g., "letterboxd_1491")
 * @param value Rating string to cache
 */
export async function setCachedRating(
  key: string,
  value: string,
): Promise<void> {
  try {
    const data: CachedRating = {
      value,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error writing cache for ${key}:`, err);
  }
}

/**
 * Clear all rating cache entries
 */
export async function clearAllRatingCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ratingKeys = keys.filter(
      (k) =>
        k.startsWith('letterboxd_') ||
        k.startsWith('omdb_') ||
        k.startsWith('imdb_'),
    );
    if (ratingKeys.length > 0) {
      await AsyncStorage.multiRemove(ratingKeys);
    }
  } catch (err) {
    console.error('Error clearing rating cache:', err);
  }
}

/**
 * Clear a specific rating cache entry
 */
export async function clearCachedRating(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error(`Error clearing cache for ${key}:`, err);
  }
}

export default function RatingCacheRoute(): null {
  return null;
}
