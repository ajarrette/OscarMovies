import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';

type PopularityKind = 'movie' | 'people';

type SupabasePopularityRow = {
  tmdb_id: number | string | null;
  popularity: number | string | null;
};

const SYNC_TTL_MS = 6 * 60 * 60 * 1000;
const LAST_SYNC_KEY_PREFIX = 'supabase_popularity_last_sync_';

const inFlightSyncs = new Map<PopularityKind, Promise<void>>();
const memoryLastSync = new Map<PopularityKind, number>();
let hasWarnedMissingConfig = false;
let sqliteWriteQueue: Promise<void> = Promise.resolve();

function enqueueSqliteWrite(operation: () => Promise<void>): Promise<void> {
  const queued = sqliteWriteQueue.then(operation, operation);
  sqliteWriteQueue = queued.catch(() => undefined);
  return queued;
}

function shouldShowUrlHint(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes('PGRST125') ||
    message.includes('Invalid path specified in request URL')
  );
}

function toInteger(value: number | string | null): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function toFiniteNumber(value: number | string | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeSupabaseRestBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const marker = '/rest/v1';

  try {
    const parsed = new URL(trimmed);
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex >= 0) {
      parsed.pathname = parsed.pathname.slice(0, markerIndex + marker.length);
    } else {
      const basePath = parsed.pathname.replace(/\/$/, '');
      parsed.pathname = `${basePath}${marker}`;
    }

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    const markerIndex = trimmed.indexOf(marker);
    const base =
      markerIndex >= 0
        ? trimmed.slice(0, markerIndex + marker.length)
        : `${trimmed.replace(/\/$/, '')}${marker}`;
    return base.replace(/\/$/, '');
  }
}

function getSupabaseConfig(): {
  baseUrl: string;
  publishableKey: string;
  rawUrl: string;
} | null {
  const rawUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY ??
    '';

  const trimmedUrl = rawUrl.trim();
  const trimmedKey = publishableKey.trim();

  if (!trimmedUrl || !trimmedKey) {
    return null;
  }

  const baseUrl = normalizeSupabaseRestBaseUrl(trimmedUrl);

  return {
    baseUrl,
    publishableKey: trimmedKey,
    rawUrl: trimmedUrl,
  };
}

function getTableNames(kind: PopularityKind): {
  sourceTable: 'movie_popularity' | 'people_popularity';
  cacheTable: 'movie_popularity_cache' | 'people_popularity_cache';
} {
  if (kind === 'movie') {
    return {
      sourceTable: 'movie_popularity',
      cacheTable: 'movie_popularity_cache',
    };
  }

  return {
    sourceTable: 'people_popularity',
    cacheTable: 'people_popularity_cache',
  };
}

async function fetchSupabasePopularity(
  kind: PopularityKind,
): Promise<SupabasePopularityRow[]> {
  const config = getSupabaseConfig();
  if (!config) {
    if (!hasWarnedMissingConfig) {
      hasWarnedMissingConfig = true;
      console.warn(
        'Supabase popularity sync disabled: missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
      );
    }
    return [];
  }

  const { sourceTable } = getTableNames(kind);
  const params = new URLSearchParams({
    select: 'tmdb_id,popularity',
    order: 'popularity.desc',
    limit: '5000',
  });
  const url = `${config.baseUrl}/${sourceTable}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
      },
    });
  } catch (error) {
    throw new Error(
      [
        `Supabase ${sourceTable} fetch failed before receiving a response.`,
        `Request: GET ${url}`,
        `Configured EXPO_PUBLIC_SUPABASE_URL: ${config.rawUrl}`,
        `Resolved REST base URL: ${config.baseUrl}`,
        `Network error: ${String(error)}`,
      ].join('\n'),
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const bodyPreview = body.length > 1000 ? `${body.slice(0, 1000)}...` : body;
    throw new Error(
      [
        `Supabase ${sourceTable} fetch failed with HTTP ${response.status}.`,
        `Request: GET ${url}`,
        `Configured EXPO_PUBLIC_SUPABASE_URL: ${config.rawUrl}`,
        `Resolved REST base URL: ${config.baseUrl}`,
        bodyPreview
          ? `Response body: ${bodyPreview}`
          : 'Response body: <empty>',
      ].join('\n'),
    );
  }

  const data = (await response.json()) as SupabasePopularityRow[];
  return Array.isArray(data) ? data : [];
}

async function ensureCacheTables(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS movie_popularity_cache (
      tmdb_id INTEGER PRIMARY KEY,
      popularity REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people_popularity_cache (
      tmdb_id INTEGER PRIMARY KEY,
      popularity REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);
}

async function writePopularityCache(
  db: SQLiteDatabase,
  kind: PopularityKind,
  rows: SupabasePopularityRow[],
): Promise<{ inserted: number; skippedInvalidTmdbId: number }> {
  const { cacheTable } = getTableNames(kind);
  const now = Date.now();
  let inserted = 0;
  let skippedInvalidTmdbId = 0;

  await enqueueSqliteWrite(async () => {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`DELETE FROM ${cacheTable};`);

      for (const row of rows) {
        const tmdbId = toInteger(row.tmdb_id);
        if (tmdbId == null) {
          skippedInvalidTmdbId += 1;
          continue;
        }

        const popularity = toFiniteNumber(row.popularity);

        await db.runAsync(
          `INSERT INTO ${cacheTable} (tmdb_id, popularity, updated_at) VALUES (?, ?, ?)`,
          [tmdbId, popularity, now],
        );
        inserted += 1;
      }
    });
  });

  return {
    inserted,
    skippedInvalidTmdbId,
  };
}

async function getLastSync(kind: PopularityKind): Promise<number> {
  const memoryValue = memoryLastSync.get(kind);
  if (typeof memoryValue === 'number') {
    return memoryValue;
  }

  const key = `${LAST_SYNC_KEY_PREFIX}${kind}`;
  const stored = await AsyncStorage.getItem(key);
  const parsed = stored ? Number(stored) : 0;
  const value = Number.isFinite(parsed) ? parsed : 0;
  memoryLastSync.set(kind, value);
  return value;
}

async function setLastSync(
  kind: PopularityKind,
  timestamp: number,
): Promise<void> {
  const key = `${LAST_SYNC_KEY_PREFIX}${kind}`;
  memoryLastSync.set(kind, timestamp);
  await AsyncStorage.setItem(key, String(timestamp));
}

export async function ensurePopularityCacheFresh(
  db: SQLiteDatabase,
  kind: PopularityKind,
): Promise<void> {
  await ensureCacheTables(db);

  const lastSync = await getLastSync(kind);
  if (lastSync > 0 && Date.now() - lastSync < SYNC_TTL_MS) {
    return;
  }

  const existing = inFlightSyncs.get(kind);
  if (existing) {
    await existing;
    return;
  }

  const syncPromise = (async () => {
    try {
      const rows = await fetchSupabasePopularity(kind);
      const writeStats = await writePopularityCache(db, kind, rows);
      console.log(
        `Synced ${kind} popularity cache: fetched=${rows.length}, inserted=${writeStats.inserted}, skipped_invalid_tmdb_id=${writeStats.skippedInvalidTmdbId}`,
      );

      if (rows.length > 0 && writeStats.inserted === 0) {
        console.warn(
          `All ${kind} popularity rows were skipped during cache write. Check tmdb_id type/values in Supabase ${getTableNames(kind).sourceTable}.`,
        );
      }

      await setLastSync(kind, Date.now());
    } catch (error) {
      console.warn(`Failed to sync ${kind} popularity cache:`, error);
      if (shouldShowUrlHint(error)) {
        console.warn(
          'Hint: EXPO_PUBLIC_SUPABASE_URL should be your Supabase project URL (or /rest/v1), not a table endpoint.',
        );
      }
    }
  })().finally(() => {
    inFlightSyncs.delete(kind);
  });

  inFlightSyncs.set(kind, syncPromise);
  await syncPromise;
}

export async function ensureAllPopularityCachesFresh(
  db: SQLiteDatabase,
): Promise<void> {
  await ensurePopularityCacheFresh(db, 'movie');
  await ensurePopularityCacheFresh(db, 'people');
}
