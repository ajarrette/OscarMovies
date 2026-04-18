import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import ImageSizing from '@/app/services/imageSizing';
import MoviePoster from '@/app/components/moviePoster';
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
    COALESCE(p.nominations, 0) DESC,
    COALESCE(p.popularity, 0) DESC,
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

function SearchContent() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const usesNativeHeaderSearch = Platform.OS === 'ios';
  const [mode, setMode] = useState<SearchMode>('films');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

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
                   ORDER BY popularity DESC, wins DESC, title ASC
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
                   WHERE title LIKE '%' || ? || '%' COLLATE NOCASE
                      OR original_title LIKE '%' || ? || '%' COLLATE NOCASE
                   ORDER BY
                     CASE
                       WHEN title LIKE ? || '%' COLLATE NOCASE THEN 0
                       WHEN original_title LIKE ? || '%' COLLATE NOCASE THEN 1
                       ELSE 2
                     END,
                     popularity DESC,
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
          // Default view: top actors ordered by nomination count, fast index scan.
          rows = await db.getAllAsync<PersonSearchRow>(
            `SELECT ${PEOPLE_FIELDS}
             FROM people p
             WHERE p.known_for_department = 'Acting'
             ORDER BY
               (
                 COALESCE(p.popularity, 0) *
                 COALESCE(
                   (
                     SELECT COUNT(DISTINCT mc.movie_id)
                     FROM movie_cast mc
                     INNER JOIN movies m ON m.id = mc.movie_id
                     WHERE mc.person_id = p.id
                       AND m.release_date IS NOT NULL
                       AND DATE(m.release_date) >= DATE('now', '-3 years')
                       AND m.popularity >= 20
                   ) * 0.2,
                   0
                 )
               ) DESC
             LIMIT ${DEFAULT_RESULTS_LIMIT}`,
          );
        } else {
          // Phase 1: prefix match — uses idx_people_department_name_nocase if
          // available, otherwise a normal name B-tree prefix scan.
          const prefixRows = await db.getAllAsync<PersonSearchRow>(
            `SELECT ${PEOPLE_FIELDS}
             FROM people p
             WHERE p.name LIKE ? || '%' COLLATE NOCASE
             ${PEOPLE_ORDER_BY_RELEVANCE}
             LIMIT ${PEOPLE_PREFIX_LIMIT}`,
            [debouncedQuery],
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
               WHERE p.name LIKE '%' || ? || '%' COLLATE NOCASE
                 AND p.name NOT LIKE ? || '%' COLLATE NOCASE
               ${PEOPLE_ORDER_BY_RELEVANCE}
               LIMIT ${PEOPLE_CONTAINS_LIMIT}`,
              [debouncedQuery, debouncedQuery],
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
            meta: row.known_for_department,
            imagePath: row.profile_path,
            wins: row.wins,
            nominations: row.nominations,
          })),
        );
      } finally {
        if (!cancelled) {
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
  const onOpenItem = useCallback((kind: SearchMode, id: number) => {
    if (kind === 'films') {
      router.push(`/search/films/${id}`);
      return;
    }

    router.push(`/search/people/${id}`);
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
            onPress={() => setMode('films')}
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
            onPress={() => setMode('people')}
            style={[
              styles.toggleButton,
              mode === 'people' && styles.toggleActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                mode === 'people' && styles.toggleTextActive,
              ]}
            >
              People
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [mode, query, usesNativeHeaderSearch],
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
          headerLargeTitle: usesNativeHeaderSearch,
          headerSearchBarOptions: usesNativeHeaderSearch
            ? {
                placeholder:
                  mode === 'films' ? 'Search films' : 'Search people',
                onChangeText: (event) => setQuery(event.nativeEvent.text),
              }
            : undefined,
        }}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            ListHeaderComponent={listHeaderComponent}
            ListEmptyComponent={listEmptyComponent}
            ListFooterComponent={listFooterComponent}
            contentContainerStyle={[
              styles.listContent,
              listData.length === 0 && styles.listContentEmpty,
            ]}
            contentInsetAdjustmentBehavior='automatic'
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            removeClippedSubviews
            keyboardDismissMode='on-drag'
            keyboardShouldPersistTaps='handled'
            updateCellsBatchingPeriod={50}
            windowSize={8}
            renderItem={renderItem}
          />
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}

export default function SearchScreen() {
  return (
    <View style={styles.screen}>
      <SearchContent />
    </View>
  );
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
});
