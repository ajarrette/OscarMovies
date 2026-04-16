import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import FilmsList from '../components/filmsList';
import type { CategoryGroup } from '../components/filmsList';
import FilmsYearPicker from '../components/filmsYearPicker';

type NominationMovieRow = {
  category_id: number;
  category_name: string;
  movie_id: number;
  movie_title: string;
  is_winner: number;
  person_name: string | null;
  song_title: string | null;
};

type YearLabelRow = {
  year_label: string;
};

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
        const validYears = yearRows
          .map((row) => Number(row.year_label))
          .filter((year) => Number.isInteger(year));

        if (validYears.length === 0) {
          setYears([]);
          setSelectedYear(null);
          return;
        }

        const minYear = Math.min(...validYears);
        const maxYear = Math.max(...validYears);
        console.log(`films-year-range-min: ${minYear}`);
        console.log(`films-year-range-max: ${maxYear}`);

        const yearRange = Array.from(
          { length: maxYear - minYear + 1 },
          (_, index) => minYear + index,
        );
        setYears(yearRange);
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
        console.log(`films-selected-year: ${selectedYear}`);
        const rows = await db.getAllAsync<NominationMovieRow>(
          `SELECT c.id AS category_id,
                  c.name AS category_name,
                  m.id AS movie_id,
                  m.title AS movie_title,
                  n.won AS is_winner,
                  p.name AS person_name,
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
           LEFT JOIN nomination_people np
             ON np.nomination_id = n.id
            AND np.ordinal = nm.ordinal
           LEFT JOIN people p ON p.id = np.person_id
           WHERE CAST(cer.year_label AS INTEGER) = ?
           ORDER BY c.name ASC, m.title ASC, p.name ASC`,
          [selectedYear],
        );

        const groupedByCategory = new Map<number, CategoryGroup>();
        let actorRowsWithPerson = 0;
        let actorRowsMissingPerson = 0;

        rows.forEach((row) => {
          const existingGroup = groupedByCategory.get(row.category_id);
          const personFirst = isActorActressCategory(row.category_name);
          const songFirst = isSongCategory(row.category_name);

          if (personFirst) {
            if (row.person_name) {
              actorRowsWithPerson += 1;
            } else {
              actorRowsMissingPerson += 1;
            }
          }

          if (existingGroup) {
            existingGroup.movies.push({
              id: row.movie_id,
              title: row.movie_title,
              isWinner: row.is_winner === 1,
              personName: row.person_name,
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
                isWinner: row.is_winner === 1,
                personName: row.person_name,
                songTitle: row.song_title,
              },
            ],
          });
        });

        const groups = Array.from(groupedByCategory.values());
        console.log(`films-year-${selectedYear}-movie-rows: ${rows.length}`);
        console.log(
          `films-year-${selectedYear}-category-count: ${groups.length}`,
        );
        console.log(
          `films-year-${selectedYear}-actor-rows-with-person: ${actorRowsWithPerson}`,
        );
        console.log(
          `films-year-${selectedYear}-actor-rows-missing-person: ${actorRowsMissingPerson}`,
        );
        setCategoryGroups(groups);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load films');
      } finally {
        setIsLoadingFilms(false);
      }
    };

    loadNominations();
  }, [db, selectedYear]);

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
