import Film from '@/types/film';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import {
  getCachedLetterboxdFilmData,
  type LetterboxdFilmData,
} from '../services/letterboxd-film-service';
import { getGenreAdjacentMovieIds } from '../services/genres';
import { getYearAdjacentMovieIds } from '../services/years';
import { getFilmRatingLabel, useOmdbRatings } from '../utils/index';
import FilmRatings from './filmRatings';
import LetterboxdFilmScraper from './letterboxdFilmScraper';
import type { FilmCastPerson } from './loadFilmDetail';
import MoviePoster from './moviePoster';
import NomineeStrip from './nomineeStrip';

type Props = {
  film: Film;
  directorPersonId?: number | null;
  castPeople?: FilmCastPerson[];
  nominationsPath?:
    | '/film-nominations/[id]'
    | '/film-details/[id]/nominations'
    | '/genre-films/films/[id]/nominations'
    | '/(tabs)/genres/films/[id]/nominations';
};

const { width } = Dimensions.get('window');
const IMG_HEIGHT = 300;
const CAST_ITEM_GAP = 12;
const CAST_VISIBLE_COUNT = 3;
const CAST_LIST_WIDTH = width - 40;
const CAST_ITEM_WIDTH =
  (CAST_LIST_WIDTH - CAST_ITEM_GAP * (CAST_VISIBLE_COUNT - 1)) /
  CAST_VISIBLE_COUNT;
const CAST_AVATAR_SIZE = 82;
const DEFAULT_BACKGROUND = '#25292e';
const SWIPE_TRIGGER_DISTANCE = 56;
type GradientPalette = [string, string, string];
const FALLBACK_GRADIENT: GradientPalette = [
  '#12161b',
  '#1b2128',
  DEFAULT_BACKGROUND,
];

type IOSImageColors = {
  platform: 'ios';
  background: string;
  primary: string;
  detail: string;
};

type AndroidOrWebImageColors = {
  platform: 'android' | 'web';
  dominant: string;
  vibrant: string;
  darkVibrant: string;
  muted: string;
};

type ImageColorsResult = IOSImageColors | AndroidOrWebImageColors;

type ImageColorsModule = {
  getColors: (
    uri: string,
    config?: {
      fallback?: string;
      cache?: boolean;
      key?: string;
      quality?: 'lowest' | 'low' | 'high' | 'highest';
    },
  ) => Promise<ImageColorsResult>;
};

function canUseNativeImageColors() {
  if (Constants.appOwnership === 'expo') {
    // Expo Go doesn't include this native module.
    return false;
  }

  return Boolean(requireOptionalNativeModule('ImageColors'));
}

const gradientCache = new Map<string, GradientPalette>();

function parseHexColor(color: string) {
  const normalized = color.trim().replace('#', '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function darkenColor(color: string, amount: number) {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return color;
  }

  const clamp = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * (1 - amount))));

  const toHex = (value: number) => clamp(value).toString(16).padStart(2, '0');
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

function getContrastOpacity(color: string) {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return 0.34;
  }

  const luminance =
    (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;

  if (luminance > 0.72) {
    return 0.52;
  }

  if (luminance > 0.55) {
    return 0.44;
  }

  return 0.34;
}

function toGradientColors(colors: ImageColorsResult) {
  let palette: string[];

  if (colors.platform === 'ios') {
    palette = [colors.background, colors.primary, colors.detail];
  } else {
    palette = [
      colors.darkVibrant || colors.dominant,
      colors.vibrant || colors.muted || colors.dominant,
      colors.muted || colors.dominant,
    ];
  }

  const sanitized = palette.map((entry) => entry || DEFAULT_BACKGROUND);
  return [
    darkenColor(sanitized[0], 0.32),
    darkenColor(sanitized[1], 0.42),
    darkenColor(sanitized[2], 0.58),
  ] as GradientPalette;
}

function formatMovieDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const hoursPart = hours > 0 ? `${hours}h ` : '';
  const minutesPart = minutes > 0 || hours === 0 ? `${minutes}m` : '';

  return `${hoursPart}${minutesPart}`.trim();
}

export default function FilmDetail({
  film,
  directorPersonId = null,
  castPeople = [],
  nominationsPath = '/film-nominations/[id]',
}: Props) {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{
    originTab?: string | string[];
    genreId?: string | string[];
    fromGenreList?: string | string[];
    year?: string | string[];
    fromYearList?: string | string[];
    detailPath?: string | string[];
    swipeDirection?: string | string[];
  }>();
  const firstParam = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;
  const originTab = firstParam(params.originTab);
  const genreIdParam = firstParam(params.genreId);
  const fromGenreListParam = firstParam(params.fromGenreList);
  const yearParam = firstParam(params.year);
  const fromYearListParam = firstParam(params.fromYearList);
  const detailPathParam = firstParam(params.detailPath);
  const swipeDirectionParam = firstParam(params.swipeDirection);
  const genreId = Number(genreIdParam ?? '0');
  const year = Number(yearParam ?? '0');
  const isGenreSwipeEnabled =
    fromGenreListParam === '1' && Number.isInteger(genreId) && genreId >= 0;
  const isYearSwipeEnabled =
    fromYearListParam === '1' && Number.isInteger(year) && year > 0;
  const isListSwipeEnabled = isGenreSwipeEnabled || isYearSwipeEnabled;
  const detailPath =
    detailPathParam === '/genre-films/films/[id]' ||
    detailPathParam === '/film-details/[id]' ||
    detailPathParam === '/year-films/films/[id]'
      ? detailPathParam
      : '/film-details/[id]';
  const [adjacentGenreMovieIds, setAdjacentGenreMovieIds] = useState<{
    previousId: number | null;
    nextId: number | null;
  }>({
    previousId: null,
    nextId: null,
  });
  const isSwipeNavigatingRef = useRef(false);
  const lastBoundaryHapticAtRef = useRef(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const title = film.title ?? 'Unknown Title';
  const originalTitle = film.original_title ?? title;
  const director = film.director ?? 'Unknown';
  const overview = film.overview ?? 'No overview available.';
  const runtimeText =
    typeof film.runtime === 'number'
      ? formatMovieDuration(film.runtime)
      : 'Runtime N/A';
  const genres = film.genres?.filter(Boolean) ?? [];
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
  const [gradientColors, setGradientColors] =
    useState<GradientPalette>(FALLBACK_GRADIENT);
  const [LetterboxdFilmData, setLetterboxdFilmData] =
    useState<LetterboxdFilmData | null>(null);
  const [shouldScrapeLetterboxd, setShouldScrapeLetterboxd] =
    useState<boolean>(false);
  const { omdbRatingsData, isOmdbLoading } = useOmdbRatings(film.imdb_id);

  const truncateText = (text: string, limit: number = 25): string => {
    if (text.length <= limit) {
      return text;
    }

    return text.slice(0, limit) + '...';
  };

  useEffect(() => {
    let isDisposed = false;

    if (!backdropUri) {
      setGradientColors(FALLBACK_GRADIENT);
      return () => {
        isDisposed = true;
      };
    }

    const cached = gradientCache.get(backdropUri);
    if (cached) {
      setGradientColors(cached);
      return () => {
        isDisposed = true;
      };
    }

    const loadGradient = async () => {
      try {
        if (!canUseNativeImageColors()) {
          if (!isDisposed) {
            setGradientColors(FALLBACK_GRADIENT);
          }
          return;
        }

        const imageColorsImport = await import('react-native-image-colors');
        const imageColors = imageColorsImport.default as ImageColorsModule;
        const colors = await imageColors.getColors(backdropUri, {
          fallback: DEFAULT_BACKGROUND,
          cache: true,
          key: `film-backdrop-${film.id}`,
          quality: 'low',
        });

        const nextGradient = toGradientColors(colors);
        gradientCache.set(backdropUri, nextGradient);
        if (!isDisposed) {
          setGradientColors(nextGradient);
        }
      } catch {
        if (!isDisposed) {
          setGradientColors(FALLBACK_GRADIENT);
        }
      }
    };

    loadGradient();

    return () => {
      isDisposed = true;
    };
  }, [backdropUri, film.id]);

  useEffect(() => {
    let isDisposed = false;
    const tmdbId = String(film.tmdb_id || '').trim();

    if (!tmdbId) {
      setLetterboxdFilmData({ rating: 'N/A' });
      setShouldScrapeLetterboxd(false);
      return () => {
        isDisposed = true;
      };
    }

    const loadLetterboxdFilmData = async () => {
      const cachedMovieData = await getCachedLetterboxdFilmData(tmdbId);

      if (isDisposed) {
        return;
      }

      if (cachedMovieData) {
        setLetterboxdFilmData(cachedMovieData);
        setShouldScrapeLetterboxd(false);
      } else {
        setLetterboxdFilmData(null);
        setShouldScrapeLetterboxd(true);
      }
    };

    loadLetterboxdFilmData();

    return () => {
      isDisposed = true;
    };
  }, [film.tmdb_id]);

  const onLetterboxdFilmDataFound = (data: LetterboxdFilmData) => {
    setLetterboxdFilmData(data);
    setShouldScrapeLetterboxd(false);
  };

  const contrastOverlayOpacity = useMemo(
    () => getContrastOpacity(gradientColors[0] || DEFAULT_BACKGROUND),
    [gradientColors],
  );

  const bodyBackgroundColor = useMemo(
    () => darkenColor(gradientColors[2] || DEFAULT_BACKGROUND, 0.28),
    [gradientColors],
  );

  const heroOverlayBottomOpacity = useMemo(
    () => Math.min(0.86, Math.max(0.64, contrastOverlayOpacity + 0.28)),
    [contrastOverlayOpacity],
  );

  const showCustomTopControls = Platform.OS === 'ios' && isListSwipeEnabled;
  const topControlInset = Math.max(10, Constants.statusBarHeight + 4);

  const onShowNominations = () => {
    router.push({
      pathname: nominationsPath,
      params: {
        id: String(film.id),
        originTab,
      },
    } as Href);
  };

  const onDismissFilmDetail = useCallback(() => {
    if (originTab === 'search') {
      router.dismissTo('/(tabs)/search');
      return;
    }

    if (originTab === 'genres') {
      router.dismissTo('/(tabs)/genres');
      return;
    }

    if (originTab === 'films') {
      router.dismissTo('/(tabs)/films');
      return;
    }

    router.dismissAll();
  }, [originTab, router]);

  const onOpenListSwipeNeighbor = useCallback(
    (targetFilmId: number, direction: 'next' | 'previous') => {
      if (!isListSwipeEnabled || targetFilmId <= 0) {
        return;
      }

      if (isSwipeNavigatingRef.current) {
        return;
      }

      isSwipeNavigatingRef.current = true;
      router.replace({
        pathname: detailPath,
        params: {
          id: String(targetFilmId),
          originTab,
          ...(isGenreSwipeEnabled
            ? {
                genreId: String(genreId),
                fromGenreList: '1',
              }
            : {
                year: String(year),
                fromYearList: '1',
              }),
          detailPath,
          swipeDirection: direction === 'previous' ? 'from-left' : 'from-right',
        },
      } as Href);
    },
    [
      detailPath,
      genreId,
      isGenreSwipeEnabled,
      isListSwipeEnabled,
      originTab,
      router,
      year,
    ],
  );

  const onBoundarySwipeAttempt = useCallback(() => {
    const now = Date.now();
    if (now - lastBoundaryHapticAtRef.current < 250) {
      return;
    }

    lastBoundaryHapticAtRef.current = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      Vibration.vibrate(8);
    });
  }, []);

  const onShowDirector = () => {
    if (directorPersonId === null) {
      return;
    }

    router.push({
      pathname: '/people/[id]',
      params: {
        id: String(directorPersonId),
        originTab,
      },
    });
  };

  const onShowCastPerson = (personId: number) => {
    router.push({
      pathname: '/people/[id]',
      params: {
        id: String(personId),
        originTab,
      },
    });
  };

  const onShowGenre = async (genreName: string) => {
    try {
      const foundGenre = await db.getFirstAsync<{ id: number } | null>(
        'SELECT id FROM tmdb_genres WHERE name = ? COLLATE NOCASE LIMIT 1',
        [genreName],
      );

      if (!foundGenre?.id) {
        return;
      }

      router.push({
        pathname: '/genre-films/[genreId]',
        params: {
          genreId: String(foundGenre.id),
          genreName,
          originTab,
        },
      });
    } catch (error) {
      console.warn('Failed to open genre screen:', error);
    }
  };

  const onShowYear = () => {
    const parsedYear = Number(releaseYear);
    if (!Number.isInteger(parsedYear) || parsedYear <= 0) {
      return;
    }

    router.push({
      pathname: '/year-films/[year]',
      params: {
        year: String(parsedYear),
        originTab,
      },
    });
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

  const filmRating = getFilmRatingLabel(omdbRatingsData, isOmdbLoading);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollOffset.value,
        [0, IMG_HEIGHT / 1.5],
        [0, 0.82],
        Extrapolation.CLAMP,
      ),
    };
  });

  const bodyAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollOffset.value,
        [0, IMG_HEIGHT * 0.75],
        [1, 0.85],
        Extrapolation.CLAMP,
      ),
    };
  });

  useEffect(() => {
    isSwipeNavigatingRef.current = false;
  }, [film.id]);

  useEffect(() => {
    let cancelled = false;

    if (!isListSwipeEnabled) {
      setAdjacentGenreMovieIds({ previousId: null, nextId: null });
      return () => {
        cancelled = true;
      };
    }

    const loadAdjacentMovies = async () => {
      try {
        const adjacent = isGenreSwipeEnabled
          ? await getGenreAdjacentMovieIds(db, genreId, film.id)
          : await getYearAdjacentMovieIds(db, year, film.id);

        if (cancelled) {
          return;
        }

        if (!adjacent) {
          setAdjacentGenreMovieIds({ previousId: null, nextId: null });
          return;
        }

        setAdjacentGenreMovieIds({
          previousId: adjacent.previousId,
          nextId: adjacent.nextId,
        });
      } catch (error) {
        if (!cancelled) {
          setAdjacentGenreMovieIds({ previousId: null, nextId: null });
          console.warn('Failed to load adjacent list movies:', error);
        }
      }
    };

    void loadAdjacentMovies();

    return () => {
      cancelled = true;
    };
  }, [db, film.id, genreId, isGenreSwipeEnabled, isListSwipeEnabled, year]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isListSwipeEnabled)
        .activeOffsetX([-22, 22])
        .failOffsetY([-14, 14])
        .onEnd((event) => {
          const deltaX = event.translationX;

          if (deltaX <= -SWIPE_TRIGGER_DISTANCE) {
            if (adjacentGenreMovieIds.nextId) {
              runOnJS(onOpenListSwipeNeighbor)(
                adjacentGenreMovieIds.nextId,
                'next',
              );
            } else {
              runOnJS(onBoundarySwipeAttempt)();
            }
            return;
          }

          if (deltaX >= SWIPE_TRIGGER_DISTANCE) {
            if (adjacentGenreMovieIds.previousId) {
              runOnJS(onOpenListSwipeNeighbor)(
                adjacentGenreMovieIds.previousId,
                'previous',
              );
            } else {
              runOnJS(onBoundarySwipeAttempt)();
            }
          }
        }),
    [
      adjacentGenreMovieIds.nextId,
      adjacentGenreMovieIds.previousId,
      isListSwipeEnabled,
      onBoundarySwipeAttempt,
      onOpenListSwipeNeighbor,
    ],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          pointerEvents='none'
          style={[
            styles.headerOverlay,
            { backgroundColor: bodyBackgroundColor },
            headerAnimatedStyle,
          ]}
        />
        <Stack.Screen
          options={{
            headerShown: !showCustomTopControls,
            headerTransparent: !showCustomTopControls,
            headerTitle: '',
            headerBackButtonDisplayMode: 'minimal',
            headerLargeTitle: false,
            headerSearchBarOptions: undefined,
            headerBlurEffect: undefined,
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTintColor: '#fff',
            animation:
              swipeDirectionParam === 'from-left'
                ? 'slide_from_left'
                : 'slide_from_right',
            gestureEnabled: !isListSwipeEnabled,
            headerLeft: !showCustomTopControls
              ? () => (
                  <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name='chevron-back' size={28} color='#fff' />
                  </Pressable>
                )
              : undefined,
            headerRight: !showCustomTopControls
              ? () => (
                  <Pressable onPress={onDismissFilmDetail} hitSlop={8}>
                    <Ionicons name='close' size={24} color='#fff' />
                  </Pressable>
                )
              : undefined,
          }}
        />
        {showCustomTopControls && (
          <View
            pointerEvents='box-none'
            style={[styles.topControlsRow, { top: topControlInset }]}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => [
                styles.topControlButton,
                pressed && styles.topControlButtonPressed,
              ]}
            >
              <Ionicons name='chevron-back' size={24} color='#fff' />
            </Pressable>
            <Pressable
              onPress={onDismissFilmDetail}
              hitSlop={8}
              style={({ pressed }) => [
                styles.topControlButton,
                pressed && styles.topControlButtonPressed,
              ]}
            >
              <Ionicons name='close' size={20} color='#fff' />
            </Pressable>
          </View>
        )}
        <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
          <View>
            <Animated.Image
              source={{
                uri: backdropUri,
              }}
              style={[styles.image, imageAnimatedStyle]}
            />
            <LinearGradient
              colors={[
                'transparent',
                `rgba(0, 0, 0, ${(heroOverlayBottomOpacity * 0.4).toFixed(2)})`,
                bodyBackgroundColor,
              ]}
              locations={[0.45, 0.75, 1]}
              style={styles.imageContrastOverlay}
            />
          </View>
          <Animated.View
            style={[
              styles.contentBody,
              { backgroundColor: bodyBackgroundColor },
              bodyAnimatedStyle,
            ]}
          >
            <View style={styles.detailsContainer}>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{title}</Text>
                  {title !== originalTitle && (
                    <Text style={styles.subtitle}>{originalTitle}</Text>
                  )}

                  <View style={styles.yearAndRatingRow}>
                    <Pressable
                      onPress={onShowYear}
                      disabled={releaseYear === 'Unknown'}
                    >
                      <Text
                        style={[
                          styles.yearAndRating,
                          styles.yearLink,
                          releaseYear === 'Unknown' && styles.yearLinkDisabled,
                        ]}
                      >
                        {releaseYear}
                      </Text>
                    </Pressable>
                    <Text style={[styles.yearAndRating, styles.yearMeta]}>
                      {' '}
                      • {filmRating} • {runtimeText}
                    </Text>
                  </View>

                  <Text style={styles.defaultText}>DIRECTED BY</Text>
                  {directorPersonId === null ? (
                    <Text style={styles.director}>{director}</Text>
                  ) : (
                    <Pressable onPress={onShowDirector}>
                      <Text style={styles.director}>{director}</Text>
                    </Pressable>
                  )}
                  {genres.length > 0 && (
                    <View style={styles.genresRow}>
                      {genres.map((genre) => (
                        <Pressable
                          key={genre}
                          onPress={() => {
                            void onShowGenre(genre);
                          }}
                          style={({ pressed }) => [
                            styles.genreChip,
                            pressed && styles.genreChipPressed,
                          ]}
                        >
                          <Text style={styles.genreChipText}>{genre}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={styles.row}>
                    <NomineeStrip
                      nominations={film.nominations}
                      wins={film.wins}
                      onPress={onShowNominations}
                    />
                  </View>
                </View>
                <View>
                  <MoviePoster
                    selectedImage={posterUri}
                    width={120}
                    height={180}
                  />
                </View>
              </View>

              <View style={[{ marginTop: 20 }]}>
                <FilmRatings
                  imdbId={film.imdb_id}
                  filmName={title}
                  letterboxdTmdbId={film.tmdb_id.toString() || ''}
                  LetterboxdFilmData={LetterboxdFilmData}
                  omdbRatingsData={omdbRatingsData}
                  isOmdbLoading={isOmdbLoading}
                  backgroundColor={gradientColors[1] || DEFAULT_BACKGROUND}
                />
              </View>
              {castPeople.length > 0 && (
                <View style={styles.castSection}>
                  <Animated.ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.castListContent}
                  >
                    {castPeople.map((person) => {
                      const castProfileUri = person.profile_path
                        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
                        : undefined;

                      return (
                        <View key={person.id} style={styles.castItem}>
                          {castProfileUri ? (
                            <MoviePoster
                              selectedImage={castProfileUri}
                              width={CAST_AVATAR_SIZE}
                              height={CAST_AVATAR_SIZE}
                              isCircle={true}
                              onPress={() => onShowCastPerson(person.id)}
                            />
                          ) : (
                            <Pressable
                              style={styles.castFallbackAvatar}
                              onPress={() => onShowCastPerson(person.id)}
                            >
                              <Text style={styles.castFallbackText}>?</Text>
                            </Pressable>
                          )}
                          <Pressable
                            onPress={() => onShowCastPerson(person.id)}
                          >
                            <Text style={styles.castName} numberOfLines={1}>
                              {truncateText(person.name || '', 14)}
                            </Text>
                            <Text
                              style={styles.characterName}
                              numberOfLines={1}
                            >
                              {truncateText(person.character || '', 18)}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </Animated.ScrollView>
                </View>
              )}
              {upperTagline && (
                <Text style={styles.tagline}>{upperTagline}</Text>
              )}
              <Text style={styles.overview}>{overview}</Text>
            </View>
          </Animated.View>
        </Animated.ScrollView>
        <LetterboxdFilmScraper
          tmdbId={film.tmdb_id}
          enabled={shouldScrapeLetterboxd}
          onMovieDataFound={onLetterboxdFilmDataFound}
        />
      </View>
    </GestureDetector>
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
    backgroundColor: DEFAULT_BACKGROUND,
  },
  contentBody: {
    paddingBottom: 24,
  },
  castFallbackAvatar: {
    width: CAST_AVATAR_SIZE,
    height: CAST_AVATAR_SIZE,
    borderRadius: CAST_AVATAR_SIZE / 2,
    backgroundColor: '#1f2226',
    alignItems: 'center',
    justifyContent: 'center',
  },
  castFallbackText: {
    color: '#9ea4ac',
    fontSize: 22,
    fontWeight: '700',
  },
  castItem: {
    width: CAST_ITEM_WIDTH,
    alignItems: 'center',
  },
  castListContent: {
    gap: CAST_ITEM_GAP,
  },
  castName: {
    marginTop: 8,
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  characterName: {
    marginTop: 2,
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  castSection: {
    marginTop: 18,
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
  genreChip: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  genreChipPressed: {
    opacity: 0.7,
  },
  genreChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  row: {
    marginTop: 0,
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
  imageContrastOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },
  topControlsRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17, 20, 24, 0.46)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topControlButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  yearAndRating: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 10,
    marginTop: -8,
  },
  yearAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 10,
  },
  yearLink: {
    marginBottom: 0,
    marginTop: 0,
    textDecorationLine: 'underline',
    fontSize: 14,
    fontWeight: '700',
    color: '#ccc',
  },
  yearLinkDisabled: {
    textDecorationLine: 'none',
  },
  yearMeta: {
    marginBottom: 0,
    marginTop: 0,
  },
});
