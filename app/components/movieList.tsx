import { useHeaderHeight } from '@react-navigation/elements';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Movie } from '../types/movie';
import MoviePoster from './moviePoster';
import { router } from 'expo-router';

type Props = {
  movies: Movie[];
};

const onShowDetails = (id: number) => {
  router.push(`/movies/${id}`);
};

export default function MovieList({ movies }: Props) {
  const headerHeight = useHeaderHeight();

  return (
    <View>
      <ScrollView style={{ paddingTop: headerHeight }}>
        {movies?.map((movie) => (
          <Pressable key={movie.id} onPress={() => onShowDetails(movie.id)}>
            <View key={movie.id} style={styles.movie}>
              <MoviePoster
                selectedImage={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                width={60}
                height={90}
                onPress={() => onShowDetails(movie.id)}
              />
              <View style={styles.details}>
                <Text style={styles.title}>{movie.title} </Text>
                <Text style={styles.defaultText}>
                  {new Date(movie.release_date).getFullYear()}, directed by{' '}
                </Text>
                <Text style={styles.director}>{movie.director}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  movie: {
    flexWrap: 'wrap',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#555',
    marginLeft: 16,
    marginRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  details: {
    paddingLeft: 10,
    flex: 1,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultText: {
    color: '#ccc',
  },
  director: {
    color: '#ccc',
    fontWeight: '800',
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
  },
});
