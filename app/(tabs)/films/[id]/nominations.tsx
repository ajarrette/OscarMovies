import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ImageSizing from '@/app/services/imageSizing';
import MoviePoster from '@/app/components/moviePoster';

const FILMS_DB_NAME = 'oscar-movies.db';

type NomineeRow = {
  nomination_id: number;
  category_name: string;
  is_winner: number;
  person_id: number | null;
  person_name: string | null;
  person_profile_path: string | null;
  person_ordinal: number | null;
};

type Nominee = {
  id: number;
  name: string;
  profilePath: string | null;
};

type NominationGroup = {
  nominationId: number;
  categoryName: string;
  isWinner: boolean;
  nominees: Nominee[];
};

function NominationsContent({ filmId }: { filmId: number }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nominations, setNominations] = useState<NominationGroup[]>([]);

  const posterWidth = ImageSizing.getImageSize(95, width - 40, 10);
  const posterScale = 115 / posterWidth;
  const posterHeight = 173 / posterScale;

  useEffect(() => {
    const loadNominations = async () => {
      try {
        setError(null);
        setLoading(true);

        const rows = await db.getAllAsync<NomineeRow>(
          `SELECT n.id AS nomination_id,
                  c.name AS category_name,
                  n.won AS is_winner,
                  p.id AS person_id,
                  p.name AS person_name,
                  p.profile_path AS person_profile_path,
                  np.ordinal AS person_ordinal
           FROM nomination_movies nm
           INNER JOIN nominations n ON n.id = nm.nomination_id
           INNER JOIN categories c ON c.id = n.category_id
           LEFT JOIN nomination_people np ON np.nomination_id = n.id
           LEFT JOIN people p ON p.id = np.person_id
           WHERE nm.movie_id = ?
           ORDER BY c.name ASC, np.ordinal ASC`,
          [filmId],
        );

        const grouped = new Map<number, NominationGroup>();
        rows.forEach((row) => {
          const existing = grouped.get(row.nomination_id);

          if (!existing) {
            grouped.set(row.nomination_id, {
              nominationId: row.nomination_id,
              categoryName: row.category_name.toUpperCase(),
              isWinner: row.is_winner === 1,
              nominees:
                row.person_id !== null && row.person_name
                  ? [
                      {
                        id: row.person_id,
                        name: row.person_name,
                        profilePath: row.person_profile_path,
                      },
                    ]
                  : [],
            });
            return;
          }

          if (row.person_id !== null && row.person_name) {
            existing.nominees.push({
              id: row.person_id,
              name: row.person_name,
              profilePath: row.person_profile_path,
            });
          }
        });

        setNominations(Array.from(grouped.values()));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load nominations',
        );
      } finally {
        setLoading(false);
      }
    };

    loadNominations();
  }, [db, filmId]);

  const emptyMessage = useMemo(() => {
    if (loading || error) {
      return null;
    }

    if (nominations.length === 0) {
      return 'No nominations found for this film.';
    }

    return null;
  }, [error, loading, nominations.length]);

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size='large' color='#fff' />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateText}>{error}</Text>
      </View>
    );
  }

  if (emptyMessage) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.contentContainer}>
      {nominations.map((nomination) => (
        <View key={nomination.nominationId} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.categoryTitle}>{nomination.categoryName}</Text>
            {nomination.isWinner && (
              <Text style={styles.winnerTag}>WINNER</Text>
            )}
          </View>

          {nomination.nominees.length > 0 ? (
            <View style={styles.nomineeGrid}>
              {nomination.nominees.map((nominee) => (
                <View
                  key={`${nomination.nominationId}-${nominee.id}`}
                  style={[styles.nomineeCard, { width: posterWidth }]}
                >
                  {nominee.profilePath ? (
                    <MoviePoster
                      selectedImage={`https://image.tmdb.org/t/p/w300${nominee.profilePath}`}
                      width={posterWidth}
                      height={posterHeight}
                      onPress={() => router.push(`/people/${nominee.id}`)}
                    />
                  ) : (
                    <Pressable
                      style={[styles.posterFallback, { height: posterHeight }]}
                      onPress={() => router.push(`/people/${nominee.id}`)}
                    >
                      <Text style={styles.posterFallbackText}>NO IMAGE</Text>
                    </Pressable>
                  )}
                  <Text style={styles.nomineeName}>{nominee.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noNomineeText}>No people listed.</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

export default function Nominations() {
  const { id } = useLocalSearchParams();
  const filmId = Number(Array.isArray(id) ? id[0] : id);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Nominations',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {Number.isFinite(filmId) ? (
        <SQLiteProvider
          databaseName={FILMS_DB_NAME}
          assetSource={{
            assetId: require('@/assets/data/oscar-movies.db'),
            forceOverwrite: true,
          }}
          options={{ useNewConnection: true }}
        >
          <NominationsContent filmId={filmId} />
        </SQLiteProvider>
      ) : (
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Invalid film ID.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#25292e',
  },
  section: {
    borderBottomWidth: 1,
    borderColor: '#555',
    paddingBottom: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  winnerTag: {
    color: '#ffd33d',
    fontSize: 12,
    fontWeight: '700',
  },
  nomineeGrid: {
    width: '100%',
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
  },
  nomineeCard: {
    gap: 6,
  },
  nomineeName: {
    color: '#fff',
    fontSize: 14,
  },
  noNomineeText: {
    color: '#ccc',
    fontSize: 14,
  },
  posterFallback: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#999',
    backgroundColor: '#1f2226',
    alignItems: 'center',
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
  stateText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});
