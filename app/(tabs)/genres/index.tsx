import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GenreListItem, getGenresWithMovieCounts } from '@/app/services/genres';

type AllMoviesCountRow = {
  movie_count: number;
};

const ALL_FILMS_GENRE_ID = 0;
const ALL_FILMS_LABEL = 'All Films';

export default function GenresIndexScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [genres, setGenres] = useState<GenreListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGenres = async () => {
      try {
        setError(null);
        setLoading(true);
        const [rows, allMoviesCountRow] = await Promise.all([
          getGenresWithMovieCounts(db),
          db.getFirstAsync<AllMoviesCountRow>(
            'SELECT COUNT(*) AS movie_count FROM movies',
          ),
        ]);

        if (cancelled) {
          return;
        }

        const allFilmsItem: GenreListItem = {
          id: ALL_FILMS_GENRE_ID,
          name: ALL_FILMS_LABEL,
          movieCount: allMoviesCountRow?.movie_count ?? 0,
        };

        setGenres([allFilmsItem, ...rows]);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load genres',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGenres();

    return () => {
      cancelled = true;
    };
  }, [db]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Genres',
          headerLargeTitle: Platform.OS === 'ios',
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect:
            Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : undefined,
        }}
      />
      <FlatList
        style={styles.container}
        data={loading || error ? [] : genres}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : 'never'
        }
        automaticallyAdjustContentInsets={Platform.OS === 'ios'}
        automaticallyAdjustsScrollIndicatorInsets={Platform.OS === 'ios'}
        ListEmptyComponent={
          <View style={styles.centered}>
            {loading ? (
              <ActivityIndicator color='#ffd33d' />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <Text style={styles.emptyText}>No genres found.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isAllFilms = item.id === ALL_FILMS_GENRE_ID;

          return (
            <Pressable
              style={[styles.row, isAllFilms && styles.allFilmsRow]}
              onPress={() =>
                router.push({
                  pathname: '/genre-films/[genreId]',
                  params: {
                    genreId: String(item.id),
                    genreName: item.name,
                    originTab: 'genres',
                  },
                })
              }
            >
              <Text
                style={[styles.genreName, isAllFilms && styles.allFilmsName]}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.genreMeta, isAllFilms && styles.allFilmsMeta]}
              >
                {item.movieCount} movies
              </Text>
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    backgroundColor: '#2d3137',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  allFilmsRow: {
    borderColor: '#5f7d99',
    backgroundColor: '#263544',
  },
  genreName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  allFilmsName: {
    color: '#cfe4f7',
    fontWeight: '700',
  },
  genreMeta: {
    color: '#aeb4bf',
    marginTop: 4,
    fontSize: 13,
  },
  allFilmsMeta: {
    color: '#9fb6cb',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    color: '#ff9b9b',
    fontSize: 14,
    textAlign: 'center',
  },
});
