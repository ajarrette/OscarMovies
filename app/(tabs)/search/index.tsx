import MoviePoster from '@/app/components/moviePoster';
import ImageSizing from '@/app/services/imageSizing';
import { ensureAllPopularityCachesFresh } from '@/app/services/popularity';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useIsFocused } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
const SEARCH_DEBOUNCE_MS = 120;
const DEFAULT_RESULTS_LIMIT = 100;
const PEOPLE_PREFIX_LIMIT = 100;
const PEOPLE_CONTAINS_LIMIT = 100;

const PEOPLE_FIELDS = `
  p.id,
  p.name,
  p.profile_path,
  p.known_for_department,
  COALESCE(p.wins, 0) AS wins,
  COALESCE(p.nominations, 0) AS nominations
` as const;

const PEOPLE_ORDER_BY_RELEVANCE = `
  ORDER BY
    COALESCE(ppc.popularity, 0) DESC,
    COALESCE(p.nominations, 0) DESC,
    p.name ASC
` as const;

type SearchMode = 'films' | 'people';

type FilmSearchRow = {
  id: number;
  title: string;
  original_title: string | null;
  poster_path: string | null;
  director: string | null;
  release_date: string | null;
  wins: number;
  nominations: number;
};

type PersonSearchRow = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
  wins: number;
  nominations: number;
};

type SearchItem = {
  id: number;
  kind: SearchMode;
  title: string;
  subtitle: string | null;
  meta: string | null;
  imagePath: string | null;
  wins: number;
  nominations: number;
};

type SearchResultRowProps = {
  item: SearchItem;
  posterWidth: number;
  posterHeight: number;
  onOpenItem: (kind: SearchMode, id: number) => void;
};

const SearchResultRow = memo(function SearchResultRow({
  item,
  posterWidth,
  posterHeight,
  onOpenItem,
}: SearchResultRowProps) {
  const imageUri = item.imagePath
    ? `https://image.tmdb.org/t/p/w300${item.imagePath}`
    : undefined;
  const handlePress = useCallback(
    () => onOpenItem(item.kind, item.id),
    [item.id, item.kind, onOpenItem],
  );

  return (
    <Pressable onPress={handlePress} style={styles.resultRow}>
      {imageUri ? (
        <MoviePoster
          selectedImage={imageUri}
          width={posterWidth}
          height={posterHeight}
          wins={item.wins}
          nominations={item.nominations}
          onPress={handlePress}
        />
      ) : (
        <View
          style={[
            styles.posterFallback,
            { width: posterWidth, height: posterHeight },
          ]}
        >
          <Text style={styles.posterFallbackText}>NO IMAGE</Text>
        </View>
      )}

      <View style={styles.copyColumn}>
        <Text style={styles.title}>{item.title}</Text>
        {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
        {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
        <Text style={styles.stats}>
          {item.wins} wins • {item.nominations} nominations
        </Text>
      </View>
    </Pressable>
  );
});

function getReleaseYear(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  const year = new Date(releaseDate).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

/**
 * Maps a department name to a specific job title.
 * Returns the original string if no mapping exists.
 */
function getJobTitleFromDepartment(department: string): string {
  const departmentMap: Record<string, string> = {
    Acting: 'Actor',
    Art: 'Artis',
    Camera: 'Camera Operator',
    Directing: 'Director',
    Editing: 'Editor',
    Production: 'Producer',
    Writing: 'Writer',
  };

  return departmentMap[department] ?? department;
}

function SearchContent() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const usesNativeHeaderSearch = Platform.OS === 'ios';
  const shouldUseNativeHeaderSearch = usesNativeHeaderSearch && isFocused;
  const [mode, setMode] = useState<SearchMode>('films');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [peopleTabPending, setPeopleTabPending] = useState(false);

  const posterWidth = ImageSizing.getImageSize(92, width - 32, 4, 120, 10);
  const posterHeight = Math.round((posterWidth / 115) * 173);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const loadResults = async () => {
      try {
        setLoading(true);
        await ensureAllPopularityCachesFresh(db);

        if (mode === 'films') {
          const rows =
            debouncedQuery.length === 0
              ? await db.getAllAsync<FilmSearchRow>(
                  `SELECT id,
                          title,
                          original_title,
                          poster_path,
                          director,
                          release_date,
                          wins,
                          nominations
                   FROM movies
                             LEFT JOIN movie_popularity_cache mpc ON mpc.tmdb_id = movies.tmdb_id
                             ORDER BY COALESCE(mpc.popularity, 0) DESC, COALESCE(nominations, 0) DESC, title ASC
                   LIMIT ${DEFAULT_RESULTS_LIMIT}`,
                )
              : await db.getAllAsync<FilmSearchRow>(
                  `SELECT id,
                          title,
                          original_title,
                          poster_path,
                          director,
                          release_date,
                          wins,
                          nominations
                   FROM movies
                       LEFT JOIN movie_popularity_cache mpc ON mpc.tmdb_id = movies.tmdb_id
                   WHERE title LIKE '%' || ? || '%' COLLATE NOCASE
                      OR original_title LIKE '%' || ? || '%' COLLATE NOCASE
                   ORDER BY
                     CASE
                       WHEN title LIKE ? || '%' COLLATE NOCASE THEN 0
                       WHEN original_title LIKE ? || '%' COLLATE NOCASE THEN 1
                       ELSE 2
                     END,
                    COALESCE(mpc.popularity, 0) DESC,
                    COALESCE(nominations, 0) DESC,
                     title ASC`,
                  [
                    debouncedQuery,
                    debouncedQuery,
                    debouncedQuery,
                    debouncedQuery,
                  ],
                );

          if (cancelled) {
            return;
          }

          setResults(
            rows.map((row) => ({
              id: row.id,
              kind: 'films',
              title: row.title,
              subtitle:
                row.original_title && row.original_title !== row.title
                  ? row.original_title
                  : null,
              meta: [getReleaseYear(row.release_date), row.director]
                .filter((value): value is string => Boolean(value))
                .join(' • '),
              imagePath: row.poster_path,
              wins: row.wins,
              nominations: row.nominations,
            })),
          );
          return;
        }

        let rows: PersonSearchRow[];

        if (debouncedQuery.length === 0) {
          // Default people view: weighted popularity.
          rows = await db.getAllAsync<PersonSearchRow>(
            `WITH recent_movie_counts AS (
               SELECT mc.person_id,
                      COUNT(DISTINCT mc.movie_id) AS recent_movie_count
               FROM movie_cast mc
               INNER JOIN movies m ON m.id = mc.movie_id
               LEFT JOIN movie_popularity_cache mpc ON mpc.tmdb_id = m.tmdb_id
               WHERE m.release_date IS NOT NULL
                 AND DATE(m.release_date) >= DATE('now', '-3 years')
                 AND COALESCE(mpc.popularity, 0) > 20
               GROUP BY mc.person_id
             )
             SELECT ${PEOPLE_FIELDS}
             FROM people p
             LEFT JOIN people_popularity_cache ppc ON ppc.tmdb_id = p.tmdb_id
             LEFT JOIN recent_movie_counts rmc ON rmc.person_id = p.id
             WHERE p.known_for_department = 'Acting'
             ORDER BY
               (
                 COALESCE(ppc.popularity, 0) *
                 COALESCE(rmc.recent_movie_count * 0.2, 0)
               ) DESC,
               COALESCE(ppc.popularity, 0) DESC,
               p.name ASC
             LIMIT ${DEFAULT_RESULTS_LIMIT}`,
          );
        } else {
          // Phase 1: word-start prefix match — treats first and last names equally
          // by matching either the start of the full name or the start of any
          // later name segment after a space.
          const prefixRows = await db.getAllAsync<PersonSearchRow>(
            `SELECT ${PEOPLE_FIELDS}
             FROM people p
             LEFT JOIN people_popularity_cache ppc ON ppc.tmdb_id = p.tmdb_id
             WHERE p.name LIKE ? || '%' COLLATE NOCASE
                OR p.name LIKE '% ' || ? || '%' COLLATE NOCASE
             ${PEOPLE_ORDER_BY_RELEVANCE}
             LIMIT ${PEOPLE_PREFIX_LIMIT}`,
            [debouncedQuery, debouncedQuery],
          );

          if (cancelled) {
            return;
          }

          if (prefixRows.length >= PEOPLE_PREFIX_LIMIT) {
            // Prefix results fill the limit — skip the more expensive scan.
            rows = prefixRows;
          } else {
            // Phase 2: contains fallback — finds "Tom Hanks" when user types "hanks".
            // Runs only when the prefix pass came up short.
            const prefixIds = new Set(prefixRows.map((r) => r.id));
            const containsRows = await db.getAllAsync<PersonSearchRow>(
              `SELECT ${PEOPLE_FIELDS}
               FROM people p
               LEFT JOIN people_popularity_cache ppc ON ppc.tmdb_id = p.tmdb_id
               WHERE p.name LIKE '%' || ? || '%' COLLATE NOCASE
                 AND p.name NOT LIKE ? || '%' COLLATE NOCASE
                 AND p.name NOT LIKE '% ' || ? || '%' COLLATE NOCASE
               ${PEOPLE_ORDER_BY_RELEVANCE}
               LIMIT ${PEOPLE_CONTAINS_LIMIT}`,
              [debouncedQuery, debouncedQuery, debouncedQuery],
            );

            if (cancelled) {
              return;
            }

            // Prefix matches first, then unique contains matches.
            rows = [
              ...prefixRows,
              ...containsRows.filter((r) => !prefixIds.has(r.id)),
            ].slice(0, DEFAULT_RESULTS_LIMIT);
          }
        }

        if (cancelled) {
          return;
        }

        setResults(
          rows.map((row) => ({
            id: row.id,
            kind: 'people',
            title: row.name,
            subtitle: null,
            meta: getJobTitleFromDepartment(
              row.known_for_department || 'Unknown',
            ),
            imagePath: row.profile_path,
            wins: row.wins,
            nominations: row.nominations,
          })),
        );
      } finally {
        if (!cancelled) {
          if (mode === 'people') {
            setPeopleTabPending(false);
          }
          setLoading(false);
        }
      }
    };

    loadResults();

    return () => {
      cancelled = true;
    };
  }, [db, debouncedQuery, mode]);

  const emptyText = useMemo(() => {
    if (loading) {
      return null;
    }

    if (debouncedQuery.length === 0) {
      return mode === 'films' ? 'No films found.' : 'No people found.';
    }

    return 'No matching results.';
  }, [debouncedQuery.length, loading, mode]);

  const listData = results;
  const isPeopleLoading = mode === 'people' && (loading || peopleTabPending);
  const onSelectMode = useCallback(
    (nextMode: SearchMode) => {
      if (nextMode === mode) {
        return;
      }

      setPeopleTabPending(nextMode === 'people');
      setLoading(true);
      setMode(nextMode);
    },
    [mode],
  );
  const onOpenItem = useCallback((kind: SearchMode, id: number) => {
    if (kind === 'films') {
      router.push({
        pathname: '/film-details/[id]',
        params: {
          id: String(id),
          originTab: 'search',
        },
      });
      return;
    }

    router.push({
      pathname: '/people/[id]',
      params: {
        id: String(id),
        originTab: 'search',
      },
    });
  }, []);
  const keyExtractor = useCallback(
    (item: SearchItem) => `${item.kind}-${item.id}`,
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: SearchItem }) => (
      <SearchResultRow
        item={item}
        posterWidth={posterWidth}
        posterHeight={posterHeight}
        onOpenItem={onOpenItem}
      />
    ),
    [onOpenItem, posterHeight, posterWidth],
  );
  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.controls}>
        {!usesNativeHeaderSearch ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={Keyboard.dismiss}
            autoCapitalize='none'
            autoCorrect={false}
            blurOnSubmit
            clearButtonMode='while-editing'
            placeholder={mode === 'films' ? 'Search films' : 'Search people'}
            placeholderTextColor='#8d9399'
            returnKeyType='search'
            style={styles.input}
          />
        ) : null}
        <Text style={styles.toggleLabel}>Search Type</Text>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => onSelectMode('films')}
            style={[
              styles.toggleButton,
              mode === 'films' && styles.toggleActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                mode === 'films' && styles.toggleTextActive,
              ]}
            >
              Films
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSelectMode('people')}
            style={[
              styles.toggleButton,
              mode === 'people' && styles.toggleActive,
            ]}
          >
            <View style={styles.peopleToggleContent}>
              <Text
                style={[
                  styles.toggleText,
                  mode === 'people' && styles.toggleTextActive,
                ]}
              >
                People
              </Text>
              {isPeopleLoading ? (
                <ActivityIndicator
                  size='small'
                  color={mode === 'people' ? '#25292e' : '#fff'}
                />
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>
    ),
    [isPeopleLoading, mode, onSelectMode, query, usesNativeHeaderSearch],
  );
  const listEmptyComponent = useMemo(
    () =>
      loading && listData.length === 0 ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size='large' color='#fff' />
        </View>
      ) : (
        <View style={styles.centeredState}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ),
    [emptyText, listData.length, loading],
  );
  const listFooterComponent = useMemo(
    () =>
      loading && listData.length > 0 ? (
        <View style={styles.footerLoading}>
          <ActivityIndicator size='small' color='#fff' />
        </View>
      ) : null,
    [listData.length, loading],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Search',
          headerLargeTitle: shouldUseNativeHeaderSearch,
          headerTransparent: shouldUseNativeHeaderSearch,
          headerBlurEffect: shouldUseNativeHeaderSearch
            ? 'systemUltraThinMaterialDark'
            : undefined,
          headerLargeStyle: shouldUseNativeHeaderSearch
            ? { backgroundColor: 'transparent' }
            : undefined,
          headerLargeTitleStyle: { color: '#fff' },
          headerSearchBarOptions: shouldUseNativeHeaderSearch
            ? {
                placeholder:
                  mode === 'films' ? 'Search films' : 'Search people',
                onChangeText: (event) => setQuery(event.nativeEvent.text),
              }
            : undefined,
        }}
      />
      <FlashList
        data={listData}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        contentContainerStyle={[
          styles.listContent,
          listData.length === 0 && styles.listContentEmpty,
        ]}
        style={styles.container}
        contentInsetAdjustmentBehavior='automatic'
        automaticallyAdjustContentInsets
        removeClippedSubviews
        keyboardDismissMode='on-drag'
        keyboardShouldPersistTaps='handled'
        renderItem={renderItem}
      />
      {isPeopleLoading ? (
        <View pointerEvents='none' style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayCard}>
            <ActivityIndicator size='large' color='#fff' />
            <Text style={styles.loadingOverlayText}>Loading people...</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

export default function SearchScreen() {
  return <SearchContent />;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#25292e',
    flex: 1,
  },
  container: {
    backgroundColor: '#25292e',
    flex: 1,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  input: {
    backgroundColor: '#1f2226',
    borderColor: '#5a6168',
    borderRadius: 10,
    borderWidth: 1,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleRow: {
    backgroundColor: '#1f2226',
    borderColor: '#5a6168',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  toggleLabel: {
    color: '#9ea4aa',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 10,
  },
  peopleToggleContent: {
    alignItems: 'center',
    columnGap: 6,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#ffd33d',
  },
  toggleText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#25292e',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  resultRow: {
    borderBottomColor: '#555',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  copyColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: '#ccc',
    fontSize: 15,
    fontStyle: 'italic',
  },
  meta: {
    color: '#ccc',
    fontSize: 13,
  },
  stats: {
    color: '#9ea4aa',
    fontSize: 13,
  },
  posterFallback: {
    alignItems: 'center',
    backgroundColor: '#1f2226',
    borderColor: '#999',
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
  },
  posterFallbackText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoading: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(37, 41, 46, 0.7)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingOverlayCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 22, 26, 0.92)',
    borderColor: '#5a6168',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  loadingOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
