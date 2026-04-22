import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MoviePoster from '@/app/components/moviePoster';
import {
  GenreMovieItem,
  getGenreNameById,
  getGenreMoviesByPopularity,
} from '@/app/services/genres';
import ImageSizing from '@/app/services/imageSizing';

const PAGE_SIZE = 100;
const POSTERS_PER_ROW = 4;

function getPosterUri(path: string | null): string | undefined {
  if (!path) {
    return undefined;
  }

  return `https://image.tmdb.org/t/p/w300${path}`;
}

export default function GenreFilmsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    genreId?: string;
    genreName?: string;
    originTab?: string;
  }>();
  const originTab = params.originTab;

  const genreId = Number(params.genreId ?? '0');
  const isAllFilms = genreId === 0;
  const [genreName, setGenreName] = useState(
    params.genreName?.trim() || 'Genre',
  );

  const [movies, setMovies] = useState<GenreMovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const posterWidth = ImageSizing.getImageSize(
    78,
    width,
    POSTERS_PER_ROW,
    160,
    0,
  );
  const posterHeight = Math.round((posterWidth / 115) * 173);

  const loadMovies = useCallback(
    async (offset: number, isLoadMore: boolean) => {
      if (!Number.isInteger(genreId) || genreId < 0) {
        setError('Invalid genre selected.');
        setLoading(false);
        return;
      }

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const nextBatch = await getGenreMoviesByPopularity(
          db,
          genreId,
          PAGE_SIZE,
          offset,
        );

        setMovies((prev) => {
          if (!isLoadMore) {
            return nextBatch;
          }

          const seen = new Set(prev.map((movie) => movie.id));
          const deduped = nextBatch.filter((movie) => !seen.has(movie.id));
          return prev.concat(deduped);
        });

        setHasMore(nextBatch.length === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load movies');
      } finally {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [db, genreId],
  );

  useEffect(() => {
    const paramGenreName = params.genreName?.trim();
    if (paramGenreName) {
      setGenreName(paramGenreName);
    }
  }, [params.genreName]);

  useEffect(() => {
    let cancelled = false;

    const loadGenreName = async () => {
      if (!Number.isInteger(genreId) || genreId <= 0) {
        return;
      }

      const foundName = await getGenreNameById(db, genreId);
      if (!cancelled && foundName?.trim()) {
        setGenreName(foundName.trim());
      }
    };

    loadGenreName();

    return () => {
      cancelled = true;
    };
  }, [db, genreId]);

  useEffect(() => {
    setMovies([]);
    setHasMore(true);
    loadMovies(0, false);
  }, [loadMovies]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMore || error !== null) {
      return;
    }

    loadMovies(movies.length, true);
  }, [error, hasMore, loadMovies, loading, loadingMore, movies.length]);

  const renderItem = useCallback(
    ({ item }: { item: GenreMovieItem }) => (
      <View style={[styles.posterCell, { width: posterWidth }]}>
        {item.posterPath ? (
          <MoviePoster
            selectedImage={getPosterUri(item.posterPath)}
            width={posterWidth}
            height={posterHeight}
            borderRadius={0}
            wins={item.wins}
            nominations={item.nominations}
            onPress={() => {
              router.push({
                pathname: '/genre-films/films/[id]',
                params: {
                  id: String(item.id),
                  genreId: String(genreId),
                  fromGenreList: '1',
                  detailPath: '/genre-films/films/[id]',
                  originTab,
                },
              });
            }}
          />
        ) : (
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/genre-films/films/[id]',
                params: {
                  id: String(item.id),
                  genreId: String(genreId),
                  fromGenreList: '1',
                  detailPath: '/genre-films/films/[id]',
                  originTab,
                },
              });
            }}
          >
            <View
              style={[
                styles.posterFallback,
                { width: posterWidth, height: posterHeight },
              ]}
            >
              <Text style={styles.fallbackText}>NO IMAGE</Text>
            </View>
          </Pressable>
        )}
      </View>
    ),
    [genreId, originTab, posterHeight, posterWidth, router],
  );

  const footer = useMemo(() => {
    if (!loadingMore) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color='#ffd33d' />
      </View>
    );
  }, [loadingMore]);

  return (
    <>
      <Stack.Screen
        options={{
          title: genreName,
          headerLargeTitle: Platform.OS === 'ios',
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect:
            Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : undefined,
          headerLeft: isFocused
            ? () => (
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={8}
                  style={styles.headerBackButton}
                >
                  <Ionicons name='chevron-back' size={24} color='#fff' />
                </Pressable>
              )
            : () => null,
          headerRight: isFocused
            ? () => (
                <Pressable
                  onPress={() => {
                    if (originTab === 'search') {
                      router.dismissTo('/(tabs)/search');
                      return;
                    }

                    if (originTab === 'films') {
                      router.dismissTo('/(tabs)/films');
                      return;
                    }

                    router.dismissTo('/(tabs)/genres');
                  }}
                  hitSlop={8}
                >
                  <Ionicons name='close' size={22} color='#fff' />
                </Pressable>
              )
            : () => null,
        }}
      />

      <FlashList
        style={styles.container}
        data={loading || error ? [] : movies}
        keyExtractor={(item) => String(item.id)}
        numColumns={POSTERS_PER_ROW}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : 'never'
        }
        automaticallyAdjustContentInsets={Platform.OS === 'ios'}
        automaticallyAdjustsScrollIndicatorInsets={Platform.OS === 'ios'}
        renderItem={renderItem}
        onEndReachedThreshold={0.7}
        onEndReached={onEndReached}
        ListEmptyComponent={
          <View style={styles.centered}>
            {loading ? (
              <ActivityIndicator color='#ffd33d' />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <Text style={styles.emptyText}>
                {isAllFilms ? 'No movies found.' : 'No movies for this genre.'}
              </Text>
            )}
          </View>
        }
        ListFooterComponent={footer}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  listContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  posterCell: {
    margin: 0,
  },
  posterFallback: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2d3137',
    paddingHorizontal: 4,
  },
  fallbackText: {
    color: '#aeb4bf',
    fontSize: 11,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  errorText: {
    color: '#ff9b9b',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
  },
  headerBackButton: {
    paddingRight: 4,
  },
  footerLoader: {
    paddingVertical: 14,
    alignItems: 'center',
  },
});
