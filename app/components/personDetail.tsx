import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import Person from '@/types/person';
import MoviePoster from './moviePoster';
import NomineeStrip from './nomineeStrip';

type Props = {
  person: Person;
};

const { width } = Dimensions.get('window');
const IMG_HEIGHT = 300;

function getYear(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  const year = date.getFullYear();
  return Number.isNaN(year) ? null : year;
}

function getAge(birthday: string | null, deathday: string | null) {
  if (!birthday) {
    return null;
  }

  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const endDate = deathday ? new Date(deathday) : new Date();
  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  let age = endDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = endDate.getMonth() - birthDate.getMonth();

  if (
    monthDelta < 0 ||
    (monthDelta === 0 && endDate.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export default function PersonDetail({ person }: Props) {
  const router = useRouter();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const name = person.name ?? 'Unknown Person';
  const biography = person.biography?.trim() || 'No biography available.';
  const knownForDepartment =
    person.known_for_department?.trim() || 'Unknown Department';
  const age = getAge(person.birthday, person.deathday);
  const ageText = age === null ? 'AGE UNKNOWN' : `AGE ${age}`;
  const birthYear = getYear(person.birthday);
  const deathYear = getYear(person.deathday);
  const subtitle = null;
  const metaParts = [
    birthYear === null ? null : `Born ${birthYear}`,
    deathYear === null ? null : `Died ${deathYear}`,
    person.place_of_birth?.trim() || null,
  ].filter((part): part is string => Boolean(part));
  const metaText =
    metaParts.length > 0 ? metaParts.join(' • ').toUpperCase() : null;
  const profileUri = person.profile_path
    ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
    : undefined;

  const onImdbPress = () => {
    if (!person.imdb_id) {
      return;
    }

    const url = `https://www.imdb.com/name/${person.imdb_id}/`;
    const handlePress = async () => {
      await Linking.openURL(url);
    };

    handlePress();
  };

  const onShowNominations = () => {
    router.push(`/people/${person.id}/nominations`);
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
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name='chevron-back' size={28} color='#fff' />
            </Pressable>
          ),
          headerBackground: () => (
            <Animated.View style={[styles.header, headerAnimatedStyle]} />
          ),
        }}
      />
      <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
        <View>
          {profileUri ? (
            <Animated.Image
              source={{ uri: profileUri }}
              style={[styles.image, imageAnimatedStyle]}
            />
          ) : (
            <View style={styles.imageFallback} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(37, 41, 46, 1)']}
            locations={[0.6, 1]}
            style={styles.imageOverlay}
          />
        </View>
        <View style={styles.surface}>
          <View style={styles.detailsContainer}>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{name}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                <Text style={styles.releaseDate}>{ageText} • KNOWN FOR</Text>
                <Text style={styles.director}>{knownForDepartment}</Text>
                {person.imdb_id && (
                  <View style={styles.row}>
                    <Pressable onPress={onImdbPress}>
                      <Text style={styles.button}>IMDB</Text>
                    </Pressable>
                  </View>
                )}
                <NomineeStrip
                  nominations={person.nominations}
                  wins={person.wins}
                  onPress={onShowNominations}
                />
              </View>
              <View>
                <MoviePoster
                  selectedImage={profileUri}
                  width={120}
                  height={120}
                  isCircle={true}
                />
              </View>
            </View>
            {metaText && <Text style={styles.tagline}>{metaText}</Text>}
            <Text style={styles.overview}>{biography}</Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
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
  detailsContainer: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  director: {
    fontSize: 18,
    color: '#ccc',
    fontWeight: '700',
    marginBottom: 10,
  },
  header: {
    backgroundColor: '#25292e',
    height: 100,
  },
  image: {
    width: width,
    height: IMG_HEIGHT,
  },
  imageFallback: {
    width: width,
    height: IMG_HEIGHT,
    backgroundColor: '#1f2226',
  },
  imageOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
    color: '#ccc',
  },
  releaseDate: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  row: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    fontSize: 18,
    fontStyle: 'italic',
    marginBottom: 12,
    marginTop: -10,
    color: '#ccc',
  },
  surface: {
    backgroundColor: '#25292e',
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
    marginBottom: 12,
    color: '#fff',
  },
  topRow: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
});
