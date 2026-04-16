import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { CategoryGroup } from '../components/filmsList';
import FilmsList from '../components/filmsList';
import FilmsYearPicker from '../components/filmsYearPicker';

const FILMS_DB_NAME = 'oscar-movies.db';

type NominationMovieRow = {
  category_id: number;
  category_name: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  is_winner: number;
  people_names: string | null;
  song_title: string | null;
};

type YearLabelRow = {
  year_label: string;
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

function isActorActressCategory(categoryName: string) {
  return /actor|actress/i.test(categoryName);
}

function isSongCategory(categoryName: string) {
  return /song/i.test(categoryName);
}

function FilmsContent() {
  const db = useSQLiteContext();
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [yearLabelsByDisplayYear, setYearLabelsByDisplayYear] = useState<
    Record<number, string[]>
  >({});
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isLoadingYears, setIsLoadingYears] = useState(true);
  const [isLoadingFilms, setIsLoadingFilms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadYearBounds = async () => {
      try {
        setError(null);
        const yearRows = await db.getAllAsync<YearLabelRow>(
          'SELECT year_label FROM ceremonies',
        );

        const labelsByDisplayYear: Record<number, string[]> = {};
        yearRows.forEach((row) => {
          const displayYear = getDisplayYearFromLabel(row.year_label);
          if (displayYear === null) {
            return;
          }

          if (!labelsByDisplayYear[displayYear]) {
            labelsByDisplayYear[displayYear] = [];
          }

          labelsByDisplayYear[displayYear].push(row.year_label);
        });

        const validYears = Object.keys(labelsByDisplayYear)
          .map((year) => Number(year))
          .filter((year) => Number.isInteger(year));

        if (validYears.length === 0) {
          setYears([]);
          setYearLabelsByDisplayYear({});
          setSelectedYear(null);
          return;
        }

        const minYear = Math.min(...validYears);
        const maxYear = Math.max(...validYears);

        const yearRange = Array.from(
          { length: maxYear - minYear + 1 },
          (_, index) => minYear + index,
        );
        setYears(yearRange);
        setYearLabelsByDisplayYear(labelsByDisplayYear);
        setSelectedDecade(Math.floor(maxYear / 10) * 10);
        setSelectedYear(maxYear);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load years for films',
        );
      } finally {
        setIsLoadingYears(false);
      }
    };

    loadYearBounds();
  }, [db]);

  useEffect(() => {
    if (selectedDecade === null) {
      return;
    }

    const decadeYears = years
      .filter((year) => Math.floor(year / 10) * 10 === selectedDecade)
      .sort((a, b) => b - a);

    if (decadeYears.length === 0) {
      setSelectedYear(null);
      return;
    }

    if (selectedYear === null || !decadeYears.includes(selectedYear)) {
      setSelectedYear(decadeYears[0]);
    }
  }, [selectedDecade, selectedYear, years]);

  useEffect(() => {
    if (selectedYear === null) {
      setIsLoadingFilms(false);
      return;
    }

    const loadNominations = async () => {
      try {
        setError(null);
        setIsLoadingFilms(true);

        const sourceYearLabels = yearLabelsByDisplayYear[selectedYear] ?? [];
        if (sourceYearLabels.length === 0) {
          setCategoryGroups([]);
          setIsLoadingFilms(false);
          return;
        }

        const placeholders = sourceYearLabels.map(() => '?').join(', ');
        const rows = await db.getAllAsync<NominationMovieRow>(
          `SELECT c.id AS category_id,
                  c.name AS category_name,
                  m.id AS movie_id,
                  m.title AS movie_title,
                  m.poster_path AS poster_path,
                  n.won AS is_winner,
                  (
                    SELECT group_concat(all_people.name, ', ')
                    FROM (
                      SELECT p2.name AS name
                      FROM nomination_people np2
                      INNER JOIN people p2 ON p2.id = np2.person_id
                      WHERE np2.nomination_id = n.id
                      ORDER BY np2.ordinal ASC
                    ) AS all_people
                  ) AS people_names,
                  (
                    SELECT nn.nominee_text
                    FROM nomination_nominees nn
                    WHERE nn.nomination_id = n.id
                      AND nn.nominee_kind = 'song'
                    ORDER BY nn.ordinal ASC
                    LIMIT 1
                  ) AS song_title
           FROM ceremonies cer
           INNER JOIN nominations n ON n.ceremony_id = cer.id
           INNER JOIN categories c ON c.id = n.category_id
           INNER JOIN nomination_movies nm ON nm.nomination_id = n.id
           INNER JOIN movies m ON m.id = nm.movie_id
           WHERE cer.year_label IN (${placeholders})
           ORDER BY c.name ASC, m.title ASC`,
          sourceYearLabels,
        );

        const groupedByCategory = new Map<number, CategoryGroup>();

        rows.forEach((row) => {
          const existingGroup = groupedByCategory.get(row.category_id);
          const personFirst = isActorActressCategory(row.category_name);
          const songFirst = isSongCategory(row.category_name);

          if (existingGroup) {
            existingGroup.movies.push({
              id: row.movie_id,
              title: row.movie_title,
              posterPath: row.poster_path,
              isWinner: row.is_winner === 1,
              peopleNames: row.people_names,
              songTitle: row.song_title,
            });
            return;
          }

          groupedByCategory.set(row.category_id, {
            categoryId: row.category_id,
            categoryName: row.category_name,
            isPersonFirstCategory: personFirst,
            isSongFirstCategory: songFirst,
            movies: [
              {
                id: row.movie_id,
                title: row.movie_title,
                posterPath: row.poster_path,
                isWinner: row.is_winner === 1,
                peopleNames: row.people_names,
                songTitle: row.song_title,
              },
            ],
          });
        });

        const groups = Array.from(groupedByCategory.values());
        setCategoryGroups(groups);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load films');
      } finally {
        setIsLoadingFilms(false);
      }
    };

    loadNominations();
  }, [db, selectedYear, yearLabelsByDisplayYear]);

  if (isLoadingYears) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color='#fff' />
        <Text style={styles.helperText}>Loading years...</Text>
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

  if (years.length === 0 || selectedYear === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.helperText}>No valid nominee years found.</Text>
      </View>
    );
  }

  const decades = Array.from(
    new Set(years.map((year) => Math.floor(year / 10) * 10)),
  ).sort((a, b) => b - a);
  const yearsInSelectedDecade = years
    .filter(
      (year) =>
        selectedDecade !== null &&
        Math.floor(year / 10) * 10 === selectedDecade,
    )
    .sort((a, b) => b - a);

  if (isLoadingFilms) {
    return (
      <View style={styles.container}>
        <FilmsYearPicker
          decades={decades}
          yearsInSelectedDecade={yearsInSelectedDecade}
          selectedDecade={selectedDecade}
          selectedYear={selectedYear}
          onSelectDecade={setSelectedDecade}
          onSelectYear={setSelectedYear}
        />
        <View style={styles.centeredInline}>
          <ActivityIndicator color='#fff' />
          <Text style={styles.helperText}>Loading nominations...</Text>
        </View>
      </View>
    );
  }

  if (categoryGroups.length === 0) {
    return (
      <View style={styles.container}>
        <FilmsYearPicker
          decades={decades}
          yearsInSelectedDecade={yearsInSelectedDecade}
          selectedDecade={selectedDecade}
          selectedYear={selectedYear}
          onSelectDecade={setSelectedDecade}
          onSelectYear={setSelectedYear}
        />
        <View style={styles.centeredInline}>
          <Text style={styles.helperText}>
            No nomination categories found for {selectedYear}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FilmsYearPicker
        decades={decades}
        yearsInSelectedDecade={yearsInSelectedDecade}
        selectedDecade={selectedDecade}
        selectedYear={selectedYear}
        onSelectDecade={setSelectedDecade}
        onSelectYear={setSelectedYear}
      />
      <FilmsList categories={categoryGroups} />
    </View>
  );
}

export default function Films() {
  return (
    <View style={styles.container}>
      <SQLiteProvider
        databaseName={FILMS_DB_NAME}
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
  centeredInline: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
