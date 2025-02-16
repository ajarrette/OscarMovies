import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import { Movie } from '../types/movie';
import MoviePoster from './moviePoster';
import NomineeStrip from './nomineeStrip';

type Props = {
  movie: Movie;
};
const { width } = Dimensions.get('window');
const IMG_HEIGHT = 300;

export default function MovieDetail({ movie }: Props) {
  const router = useRouter();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

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

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [2, 1, 1]
          ),
        },
      ],
    };
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollOffset.value, [0, IMG_HEIGHT / 1.5], [0, 1]),
    };
  });

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerBackground: () => (
            <Animated.View style={[styles.header, headerAnimatedStyle]} />
          ),
        }}
      />
      <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
        <View>
          <Animated.Image
            source={{
              uri: `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`,
            }}
            style={[styles.image, imageAnimatedStyle]}
          />
          <LinearGradient
            colors={['transparent', 'rgba(37, 41, 46, 1)']}
            locations={[0.6, 1]}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
            }}
          />
        </View>
        <View style={{ backgroundColor: '#25292e' }}>
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
            <Text style={styles.overview}>{movie.overview}</Text>
            <Text style={styles.overview}>{movie.overview}</Text>
            <Text style={styles.overview}>{movie.overview}</Text>
            <Text style={styles.overview}>{movie.overview}</Text>
            {/* <Text style={styles.rating}>Rating: {movie.vote_average}/10</Text> */}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
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
  detailsContainer: {
    paddingLeft: 20,
    paddingRight: 20,
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
    marginTop: 20,
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
  image: {
    width: width,
    height: IMG_HEIGHT,
  },
  header: {
    backgroundColor: '#25292e',
    height: 100,
    // borderWidth: StyleSheet.hairlineWidth,
  },
});
