import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import FilmsList from '../components/filmsList';
import FilmsYearPicker from '../components/filmsYearPicker';

type FilmRow = {
  id: number;
  title: string;
  nominations: number;
};

type YearLabelRow = {
  year_label: string;
};

function FilmsContent() {
  const db = useSQLiteContext();
  const [films, setFilms] = useState<FilmRow[]>([]);
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

    const loadFilms = async () => {
      try {
        setError(null);
        setIsLoadingFilms(true);
        console.log(`films-selected-year: ${selectedYear}`);
        const rows = await db.getAllAsync<FilmRow>(
          `SELECT DISTINCT m.id, m.title, m.nominations
           FROM movies m
           INNER JOIN nomination_movies nm ON nm.movie_id = m.id
           INNER JOIN nominations n ON n.id = nm.nomination_id
           INNER JOIN ceremonies c ON c.id = n.ceremony_id
           WHERE CAST(c.year_label AS INTEGER) = ? AND m.nominations > ?
           ORDER BY m.title ASC`,
          [selectedYear, 0],
        );

        console.log(`films-year-${selectedYear}-count: ${rows.length}`);
        setFilms(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load films');
      } finally {
        setIsLoadingFilms(false);
      }
    };

    loadFilms();
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
          <Text style={styles.helperText}>Loading films...</Text>
        </View>
      </View>
    );
  }

  if (films.length === 0) {
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
            No nominated films found for {selectedYear}.
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
      <FilmsList films={films} />
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
