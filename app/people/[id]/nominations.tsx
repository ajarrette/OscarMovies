import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
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
import FilmsDbProvider from '@/app/components/filmsDbProvider';
import MoviePoster from '@/app/components/moviePoster';

type PersonNominationRow = {
  nomination_id: number;
  year_label: string;
  category_name: string;
  is_winner: number;
  movie_id: number | null;
  movie_title: string | null;
  movie_poster_path: string | null;
  song_title: string | null;
};

type PersonNominationGroup = {
  nominationId: number;
  yearLabel: string;
  displayYear: string;
  sortYear: number | null;
  categoryName: string;
  categoryKey: string;
  isWinner: boolean;
  movieId: number | null;
  movieTitle: string | null;
  moviePosterPath: string | null;
  songTitle: string | null;
};

type PersonNominationYearGroup = {
  yearKey: string;
  yearLabel: string;
  sortYear: number | null;
  nominations: PersonNominationGroup[];
};

function getDisplayYearFromLabel(yearLabel: string): number | null {
  const normalized = yearLabel.trim();

  const splitYearMatch = normalized.match(/^(\d{4})\/(\d{2}|\d{4})$/);
  if (splitYearMatch) {
    const firstYear = Number(splitYearMatch[1]);
    const secondPart = splitYearMatch[2];

    if (secondPart.length === 4) {
      return Number(secondPart);
    }

    const centuryPrefix = Math.floor(firstYear / 100) * 100;
    return centuryPrefix + Number(secondPart);
  }

  const singleYearMatch = normalized.match(/^\d{4}$/);
  if (singleYearMatch) {
    return Number(normalized) + 1;
  }

  return null;
}

function isBestOriginalSongCategory(categoryKey: string) {
  return categoryKey === 'best original song';
}

function PersonNominationsContent({ personId }: { personId: number }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nominationsByYear, setNominationsByYear] = useState<
    PersonNominationYearGroup[]
  >([]);

  const posterWidth = ImageSizing.getImageSize(95, width - 40, 10);
  const posterScale = 115 / posterWidth;
  const posterHeight = 173 / posterScale;

  useEffect(() => {
    const loadNominations = async () => {
      try {
        setError(null);
        setLoading(true);

        const rows = await db.getAllAsync<PersonNominationRow>(
          `SELECT n.id AS nomination_id,
                  cer.year_label AS year_label,
                  c.name AS category_name,
                  n.won AS is_winner,
                  m.id AS movie_id,
                  m.title AS movie_title,
                  m.poster_path AS movie_poster_path,
                  (
                    SELECT nn.nominee_text
                    FROM nomination_nominees nn
                    WHERE nn.nomination_id = n.id
                      AND nn.nominee_kind = 'song'
                    ORDER BY nn.ordinal ASC
                    LIMIT 1
                  ) AS song_title
           FROM nomination_people np
           INNER JOIN nominations n ON n.id = np.nomination_id
           INNER JOIN ceremonies cer ON cer.id = n.ceremony_id
           INNER JOIN categories c ON c.id = n.category_id
           LEFT JOIN nomination_movies nm ON nm.nomination_id = n.id
           LEFT JOIN movies m ON m.id = nm.movie_id
           WHERE np.person_id = ?
           ORDER BY cer.year_label ASC, c.name ASC, nm.ordinal ASC, m.title ASC`,
          [personId],
        );

        const grouped = new Map<number, PersonNominationGroup>();
        rows.forEach((row) => {
          if (grouped.has(row.nomination_id)) {
            return;
          }

          grouped.set(row.nomination_id, {
            nominationId: row.nomination_id,
            yearLabel: row.year_label,
            displayYear: String(
              getDisplayYearFromLabel(row.year_label) ?? row.year_label,
            ),
            sortYear: getDisplayYearFromLabel(row.year_label),
            categoryName: row.category_name.toUpperCase(),
            categoryKey: row.category_name.toLowerCase(),
            isWinner: row.is_winner === 1,
            movieId: row.movie_id,
            movieTitle: row.movie_title,
            moviePosterPath: row.movie_poster_path,
            songTitle: row.song_title,
          });
        });

        const groupedByYear = new Map<string, PersonNominationYearGroup>();
        Array.from(grouped.values()).forEach((nomination) => {
          const existingYear = groupedByYear.get(nomination.yearLabel);

          if (existingYear) {
            existingYear.nominations.push(nomination);
            return;
          }

          groupedByYear.set(nomination.yearLabel, {
            yearKey: nomination.yearLabel,
            yearLabel: nomination.displayYear,
            sortYear: nomination.sortYear,
            nominations: [nomination],
          });
        });

        const yearGroups = Array.from(groupedByYear.values()).sort((a, b) => {
          if (a.sortYear === null && b.sortYear === null) {
            return a.yearLabel.localeCompare(b.yearLabel);
          }

          if (a.sortYear === null) {
            return 1;
          }

          if (b.sortYear === null) {
            return -1;
          }

          return a.sortYear - b.sortYear;
        });

        setNominationsByYear(yearGroups);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load nominations',
        );
      } finally {
        setLoading(false);
      }
    };

    loadNominations();
  }, [db, personId]);

  const emptyMessage = useMemo(() => {
    if (loading || error) {
      return null;
    }

    if (nominationsByYear.length === 0) {
      return 'No nominations found for this person.';
    }

    return null;
  }, [error, loading, nominationsByYear.length]);

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
      {nominationsByYear.map((yearGroup) => (
        <View key={yearGroup.yearKey} style={styles.yearSection}>
          <Text style={styles.yearTitle}>{yearGroup.yearLabel}</Text>
          {yearGroup.nominations.map((nomination) => (
            <View key={nomination.nominationId} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.categoryTitle}>
                  {nomination.categoryName}
                </Text>
                {nomination.isWinner && (
                  <Text style={styles.winnerTag}>WINNER</Text>
                )}
              </View>

              {isBestOriginalSongCategory(nomination.categoryKey) ? (
                <View style={styles.nomineeGrid}>
                  <View style={styles.songTitleContainer}>
                    <Text style={styles.nomineeName}>
                      {nomination.songTitle ?? 'UNKNOWN SONG'}
                    </Text>
                    {nomination.movieTitle && (
                      <Text style={styles.movieTitle}>
                        {nomination.movieTitle}
                      </Text>
                    )}
                  </View>
                </View>
              ) : nomination.movieId !== null ? (
                <View style={styles.nomineeGrid}>
                  <View style={[styles.nomineeCard, { width: posterWidth }]}>
                    {nomination.moviePosterPath ? (
                      <MoviePoster
                        selectedImage={`https://image.tmdb.org/t/p/w300${nomination.moviePosterPath}`}
                        width={posterWidth}
                        height={posterHeight}
                        onPress={() =>
                          router.push(`/films/${nomination.movieId}`)
                        }
                      />
                    ) : (
                      <Pressable
                        style={[
                          styles.posterFallback,
                          { height: posterHeight },
                        ]}
                        onPress={() =>
                          router.push(`/films/${nomination.movieId}`)
                        }
                      >
                        <Text style={styles.posterFallbackText}>NO IMAGE</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={styles.noNomineeText}>No film listed.</Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export default function PersonNominations() {
  const { id } = useLocalSearchParams();
  const personId = Number(Array.isArray(id) ? id[0] : id);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Nominations',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {Number.isFinite(personId) ? (
        <FilmsDbProvider>
          <PersonNominationsContent personId={personId} />
        </FilmsDbProvider>
      ) : (
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Invalid person ID.</Text>
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
  yearSection: {
    marginBottom: 18,
  },
  yearTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
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
  movieTitle: {
    color: '#ccc',
    fontSize: 13,
  },
  songTitleContainer: {
    maxWidth: '100%',
    gap: 4,
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
