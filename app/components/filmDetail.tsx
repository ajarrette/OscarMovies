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
import Film from '@/types/film';
import MoviePoster from './moviePoster';
import NomineeStrip from './nomineeStrip';

type Props = {
  film: Film;
  directorPersonId?: number | null;
};

const { width } = Dimensions.get('window');
const IMG_HEIGHT = 300;

export default function FilmDetail({ film, directorPersonId = null }: Props) {
  const router = useRouter();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const title = film.title ?? 'Unknown Title';
  const originalTitle = film.original_title ?? title;
  const director = film.director ?? 'Unknown';
  const overview = film.overview ?? 'No overview available.';
  const runtimeText =
    typeof film.runtime === 'number' ? `${film.runtime} mins` : 'Runtime N/A';
  const releaseYear = (() => {
    if (!film.release_date) {
      return 'Unknown';
    }

    const date = new Date(film.release_date);
    const year = date.getFullYear();
    return Number.isNaN(year) ? 'Unknown' : String(year);
  })();
  const tagline = film.tagline?.trim();
  const upperTagline = tagline ? tagline.toUpperCase() : null;
  const backdropUri = film.backdrop_path
    ? `https://image.tmdb.org/t/p/w500${film.backdrop_path}`
    : undefined;
  const posterUri = film.poster_path
    ? `https://image.tmdb.org/t/p/w300${film.poster_path}`
    : undefined;

  const onImdbPress = () => {
    if (!film.imdb_id) {
      return;
    }

    const url = `https://www.imdb.com/title/${film.imdb_id}/`;
    const handlePress = async () => {
      await Linking.openURL(url);
    };
    handlePress();
  };

  const onShowNominations = () => {
    router.push(`/films/${film.id}/nominations`);
  };

  const onShowDirector = () => {
    if (directorPersonId === null) {
      return;
    }

    router.push(`/people/${directorPersonId}`);
  };

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75],
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [2, 1, 1],
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
          headerTransparent: true,
          headerShown: true,
          headerBackground: () => (
            <Animated.View style={[styles.header, headerAnimatedStyle]} />
          ),
        }}
      />
      <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
        <View>
          <Animated.Image
            source={{
              uri: backdropUri,
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
                <Text style={styles.title}>{title}</Text>
                {title !== originalTitle && (
                  <Text style={styles.subtitle}>{originalTitle}</Text>
                )}
                <Text style={styles.releaseDate}>
                  {releaseYear} • DIRECTED BY
                </Text>
                {directorPersonId === null ? (
                  <Text style={styles.director}>{director}</Text>
                ) : (
                  <Pressable onPress={onShowDirector}>
                    <Text style={styles.director}>{director}</Text>
                  </Pressable>
                )}
                <View style={styles.row}>
                  <Pressable onPress={onImdbPress}>
                    <Text style={styles.button}>IMDB</Text>
                  </Pressable>
                  <Text style={styles.defaultText}>{runtimeText}</Text>
                </View>
                <NomineeStrip
                  nominations={film.nominations}
                  wins={film.wins}
                  onPress={onShowNominations}
                />
              </View>
              <View>
                <MoviePoster
                  selectedImage={posterUri}
                  width={120}
                  height={180}
                />
              </View>
            </View>
            {upperTagline && <Text style={styles.tagline}>{upperTagline}</Text>}
            <Text style={styles.overview}>{overview}</Text>
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
    marginBottom: 10,
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
  subtitle: {
    fontSize: 18,
    fontStyle: 'italic',
    marginBottom: 12,
    marginTop: -10,
    color: '#ccc',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#fff',
  },
  releaseDate: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
    color: '#ccc',
  },
  image: {
    width: width,
    height: IMG_HEIGHT,
  },
  header: {
    backgroundColor: '#25292e',
    height: 100,
  },
});
