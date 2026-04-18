import { ReactNode, useCallback } from 'react';
import { SQLiteDatabase, SQLiteProvider } from 'expo-sqlite';

const FILMS_DB_NAME = 'oscar-movies.db';
let hasInitializedBundledDb = false;
let hasInitializedSchema = false;

type FilmsDbProviderProps = {
  children: ReactNode;
};

export default function FilmsDbProvider({ children }: FilmsDbProviderProps) {
  const onInit = useCallback(async (db: SQLiteDatabase) => {
    // Only initialize schema once per app session to avoid blocking UI
    if (hasInitializedSchema) {
      return;
    }
    hasInitializedSchema = true;

    // Run schema initialization asynchronously to avoid blocking UI
    // This executes after the app is rendered
    setTimeout(async () => {
      try {
        const peopleColumns = await db.getAllAsync<{ name: string }>(
          'PRAGMA table_info(people)',
        );
        const columnNames = new Set(peopleColumns.map((column) => column.name));

        if (!columnNames.has('wins')) {
          await db.execAsync(
            'ALTER TABLE people ADD COLUMN wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0);',
          );
        }

        if (!columnNames.has('nominations')) {
          await db.execAsync(
            'ALTER TABLE people ADD COLUMN nominations INTEGER NOT NULL DEFAULT 0 CHECK (nominations >= 0);',
          );
        }

        if (columnNames.has('known_for_department')) {
          await db.execAsync(`
            CREATE INDEX IF NOT EXISTS idx_people_department_name_nocase
            ON people(known_for_department, name COLLATE NOCASE);
          `);
        }

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_nomination_people_person_nomination
          ON nomination_people(person_id, nomination_id);
          CREATE INDEX IF NOT EXISTS idx_nomination_movies_nomination_ordinal_movie
          ON nomination_movies(nomination_id, ordinal, movie_id);
        `);

        const movieCastTable = await db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'movie_cast' LIMIT 1",
        );

        if (movieCastTable) {
          await db.execAsync(`
            CREATE INDEX IF NOT EXISTS idx_movie_cast_person_castorder_movie
            ON movie_cast(person_id, cast_order, movie_id);
          `);
        }
      } catch (error) {
        console.warn(
          'Schema initialization failed (may already exist):',
          error,
        );
      }
    }, 100);
  }, []);

  const shouldCopyBundledDb = !hasInitializedBundledDb;
  if (shouldCopyBundledDb) {
    hasInitializedBundledDb = true;
  }

  return (
    <SQLiteProvider
      databaseName={FILMS_DB_NAME}
      onInit={onInit}
      assetSource={
        shouldCopyBundledDb
          ? {
              assetId: require('@/assets/data/oscar-movies.db'),
            }
          : undefined
      }
    >
      {children}
    </SQLiteProvider>
  );
}
