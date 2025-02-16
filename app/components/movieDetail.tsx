import * as Linking from 'expo-linking';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Movie } from '../types/movie';
import MoviePoster from './moviePoster';
import NomineeStrip from './nomineeStrip';
import { useRouter } from 'expo-router';

type Props = {
  movie: Movie;
};

export default function MovieDetail({ movie }: Props) {
  const router = useRouter();
  const onImdbPress = () => {
    const url = `https://www.imdb.com/title/${movie.imdb_id}/`;
    const handlePress = async () => {
      await Linking.openURL(url);
    };
    handlePress();
  };

  const onShowNominations = () => {
    router.push(`/movies/${movie.id}/nominations`);
  };

  return (
    <ScrollView style={styles.container}>
      <Image
        source={{
          uri: `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`,
        }}
        style={styles.poster}
      />
      <View style={styles.detailsContainer}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{movie.title}</Text>
            {movie.title !== movie.original_title && (
              <Text style={styles.title}>{movie.original_title}</Text>
            )}
            <Text style={styles.releaseDate}>
              {new Date(movie.release_date).getFullYear()} • DIRECTED BY
            </Text>
            <Text style={styles.director}>{movie.director}</Text>
            <View style={styles.row}>
              <Pressable onPress={onImdbPress}>
                <Text style={styles.button}>IMDB</Text>
              </Pressable>
              <Text style={styles.defaultText}>{movie.runtime} mins</Text>
            </View>
            <NomineeStrip
              nominations={movie.nominations}
              wins={movie.wins}
              onPress={onShowNominations}
            />
          </View>
          <View>
            <MoviePoster
              selectedImage={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
              width={120}
              height={180}
            />
          </View>
        </View>
        <Text style={styles.tagline}>{movie.tagline.toUpperCase()}</Text>
        <Text style={styles.overview}>{movie.overview}</Text>
        {/* <Text style={styles.rating}>Rating: {movie.vote_average}/10</Text> */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 5,
    paddingRight: 5,
    color: '#ccc',
  },
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    color: '#ccc',
  },
  defaultText: {
    color: '#ccc',
  },
  director: {
    fontSize: 18,
    color: '#ccc',
    fontWeight: '700',
  },
  poster: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  detailsContainer: {
    padding: 20,
  },
  row: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 10,
  },
  topRow: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  tagline: {
    fontSize: 18,
    marginBottom: 5,
    marginTop: 10,
    color: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
  },
  releaseDate: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 10,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
    color: '#ccc',
  },
  rating: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
