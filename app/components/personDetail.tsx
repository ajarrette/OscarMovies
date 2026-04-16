import Person from '@/types/person';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import MoviePoster from './moviePoster';
import NomineeStrip from './nomineeStrip';

type Props = {
  person: Person;
};

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
  const navigation = useNavigation();
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

  const headerBackgroundAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollOffset.value,
        [0, 90],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const headerTitleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollOffset.value,
        [30, 110],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [30, 110],
            [8, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const contentTitleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollOffset.value,
        [0, 70],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [0, 70],
            [0, -6],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerTintColor: '#fff',
      headerTitle: () => (
        <Animated.Text style={[styles.headerTitle, headerTitleAnimatedStyle]}>
          {name}
        </Animated.Text>
      ),
      headerBackground: () => (
        <Animated.View
          style={[styles.headerBackground, headerBackgroundAnimatedStyle]}
        />
      ),
      headerLeft: () => (
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name='chevron-back' size={28} color='#fff' />
        </Pressable>
      ),
    });
  }, [
    navigation,
    name,
    headerTitleAnimatedStyle,
    headerBackgroundAnimatedStyle,
    router,
  ]);

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentInsetAdjustmentBehavior='automatic'
      automaticallyAdjustsScrollIndicatorInsets={true}
      scrollEventThrottle={16}
    >
      <View style={styles.content}>
        <Animated.Text
          style={[styles.name, styles.nameTop, contentTitleAnimatedStyle]}
        >
          {name}
        </Animated.Text>
        <View style={styles.profileSection}>
          <View>
            {profileUri ? (
              <MoviePoster
                selectedImage={profileUri}
                width={100}
                height={100}
                isCircle={true}
              />
            ) : (
              <View style={styles.profileImageFallback} />
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.subtitle}>{ageText}</Text>
            <Text style={styles.department}>{knownForDepartment}</Text>
            {metaText && <Text style={styles.meta}>{metaText}</Text>}
          </View>
        </View>

        <View style={styles.detailsContainer}>
          {person.imdb_id && (
            <View style={styles.buttonRow}>
              <Pressable
                onPress={onImdbPress}
                style={({ pressed }) => [
                  styles.imdbButton,
                  pressed && styles.imdbButtonPressed,
                ]}
              >
                <Ionicons name='open' size={16} color='#fff' />
                <Text style={styles.imdbButtonText}>VIEW ON IMDB</Text>
              </Pressable>
            </View>
          )}

          <NomineeStrip
            nominations={person.nominations}
            wins={person.wins}
            onPress={onShowNominations}
          />

          {biography && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Biography</Text>
              <Text style={styles.biography}>{biography}</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  biography: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ccc',
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
  buttonRow: {
    marginBottom: 24,
  },
  content: {
    paddingBottom: 40,
  },
  department: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ccc',
    marginTop: 4,
  },
  detailsContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    marginTop: 20,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  headerBackground: {
    flex: 1,
    backgroundColor: 'rgba(37, 41, 46, 0.92)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  imdbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  imdbButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  imdbButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  nameTop: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  profileImageFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1f2226',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
});
