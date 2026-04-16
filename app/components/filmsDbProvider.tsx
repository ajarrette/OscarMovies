import { ReactNode } from 'react';
import { SQLiteProvider } from 'expo-sqlite';

const FILMS_DB_NAME = 'oscar-movies.db';
let hasInitializedBundledDb = false;

type FilmsDbProviderProps = {
  children: ReactNode;
};

export default function FilmsDbProvider({ children }: FilmsDbProviderProps) {
  const shouldCopyBundledDb = !hasInitializedBundledDb;
  if (shouldCopyBundledDb) {
    hasInitializedBundledDb = true;
  }

  return (
    <SQLiteProvider
      databaseName={FILMS_DB_NAME}
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
