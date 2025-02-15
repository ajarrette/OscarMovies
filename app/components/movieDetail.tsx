import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  id: number;
};

type Movie = {
  backdrop_path: string;
  id: number;
  imdb_id: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: number;
  runtime: number;
  tagline: string;
  title: string;
};

export default function MovieDetail({ id }: Props) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [movie, setMovie] = useState<Movie | null>(null);

  useEffect(() => {
    const loadMovie = async () => {
      const foundMovie = await db.getFirstAsync<Movie | null>(
        'SELECT * FROM movies WHERE id = ?',
        [id]
      );
      setMovie(foundMovie);
      setLoading(false);
    };
    loadMovie();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator size='large' color='#fff' />
      ) : movie ? (
        <Text style={styles.text}>{JSON.stringify(movie)}</Text>
      ) : (
        <Text style={styles.text}>Not found</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#fff',
  },
});
