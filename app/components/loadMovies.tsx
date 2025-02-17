import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Movie } from '../types/movie';
import MovieList from './movieList';

export default function LoadMovies() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState<Movie[] | null>([]);

  useEffect(() => {
    const loadMovies = async () => {
      const movies = await db.getAllAsync<Movie>('SELECT * FROM movies');
      movies.sort((a, b) => a?.title.localeCompare(b?.title));
      setMovies(movies as Movie[]);
      setLoading(false);
    };
    loadMovies();
  }, []);

  return (
    <>
      {loading ? (
        <ActivityIndicator size='large' color='#fff' />
      ) : movies ? (
        <MovieList movies={movies} />
      ) : (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={styles.text}>Not found</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#fff',
  },
});
