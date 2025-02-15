import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Movie } from '../types/movie';
import MovieDetail from './movieDetail';

type Props = {
  id: number;
};

export default function LoadMovieDetail({ id }: Props) {
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

  const loadMovie = () => {
    console.log('loading movie');
  };

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
        <MovieDetail movie={movie} />
      ) : (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={styles.text}>Not found</Text>
          <Button onPress={loadMovie} title='Load movie' />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#fff',
  },
});
