import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type FilmRow = {
  id: number;
  title: string;
  nominations: number;
};

const CEREMONY_YEAR = '2022';

function FilmsContent() {
  const db = useSQLiteContext();
  const [films, setFilms] = useState<FilmRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFilms = async () => {
      try {
        const rows = await db.getAllAsync<FilmRow>(
          `SELECT DISTINCT m.id, m.title, m.nominations
           FROM movies m
           INNER JOIN nomination_movies nm ON nm.movie_id = m.id
           INNER JOIN nominations n ON n.id = nm.nomination_id
           INNER JOIN ceremonies c ON c.id = n.ceremony_id
           WHERE c.year_label = ? AND m.nominations > ?
           ORDER BY m.title ASC`,
          [CEREMONY_YEAR, 0],
        );

        console.log(`films-2022-nominated-count: ${rows.length}`);
        setFilms(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load films');
      } finally {
        setIsLoading(false);
      }
    };

    loadFilms();
  }, [db]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color='#fff' />
        <Text style={styles.helperText}>Loading films...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.helperText}>Error loading films.</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (films.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.helperText}>
          No nominated films found for 2022.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={films}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{item.title}</Text>
        </View>
      )}
    />
  );
}

export default function Films() {
  return (
    <View style={styles.container}>
      <SQLiteProvider
        databaseName='oscar-movies.db'
        assetSource={{
          assetId: require('@/assets/data/oscar-movies.db'),
          forceOverwrite: true,
        }}
        options={{ useNewConnection: true }}
      >
        <FilmsContent />
      </SQLiteProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#25292e',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#25292e',
  },
  row: {
    borderBottomWidth: 1,
    borderColor: '#555',
    paddingVertical: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#f5c2c2',
    marginTop: 8,
    textAlign: 'center',
  },
});
