import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { OmdbRatingsData } from '../services/omdb-rating-service';
import {
  getImdbDisplayRating,
  getOmdbDisplayRating,
  getOmdbSourceRatingValue,
  isRottenTomatoesRatingRotten,
  shouldUseRottenTomatoesRating,
} from '../utils/index';
import ImdbRating from './imdbRating';
import LetterboxdRating from './letterboxdRating';
import MetaCriticRating from './metaCriticRating';
import RottenTomatoRating from './rottenTomatoRating';
import type { LetterboxdFilmData } from '../services/letterboxd-film-service';

function parseHexColor(color: string) {
  const normalized = color.trim().replace('#', '');
  const hex =
    normalized.length === 3 || normalized.length === 4
      ? normalized
          .slice(0, 3)
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function getColorLuminance(color: string) {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return 0.2;
  }

  return (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;
}

function blendColor(color: string, target: number, amount: number) {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return color;
  }

  const mix = (value: number) =>
    Math.round(value + (target - value) * amount)
      .toString(16)
      .padStart(2, '0');

  return `#${mix(parsed.r)}${mix(parsed.g)}${mix(parsed.b)}`;
}

function getContrastTint(color: string, amount: number, alpha: number) {
  const luminance = getColorLuminance(color);
  const adjusted =
    luminance > 0.58
      ? blendColor(color, 0, amount)
      : blendColor(color, 255, amount);

  const parsed = parseHexColor(adjusted);
  if (!parsed) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

/**
 * Props definition for the MovieRatings component
 */
interface FilmRatingsProps {
  imdbId: string;
  filmName?: string;
  letterboxdTmdbId: string;
  LetterboxdFilmData: LetterboxdFilmData | null;
  omdbRatingsData: OmdbRatingsData | null;
  isOmdbLoading: boolean;
  backgroundColor?: string;
}

const DEFAULT_BACKGROUND_COLOR = '#2b313a';

const FilmRatings: React.FC<FilmRatingsProps> = ({
  imdbId,
  filmName = '',
  letterboxdTmdbId,
  LetterboxdFilmData,
  omdbRatingsData,
  isOmdbLoading,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
}) => {
  const imdbDisplayRating = getImdbDisplayRating(
    omdbRatingsData,
    isOmdbLoading,
  );
  const rottenTomatoesValue = getOmdbSourceRatingValue(
    omdbRatingsData,
    'Rotten Tomatoes',
  );
  const metacriticValue = getOmdbSourceRatingValue(
    omdbRatingsData,
    'Metacritic',
  );
  const rottenTomatoesDisplayRating = getOmdbDisplayRating(
    rottenTomatoesValue,
    isOmdbLoading,
  );
  const isRotten = isRottenTomatoesRatingRotten(rottenTomatoesValue);
  const metacriticDisplayRating = getOmdbDisplayRating(
    metacriticValue,
    isOmdbLoading,
  );
  const useRottenTomatoesRating = shouldUseRottenTomatoesRating(
    rottenTomatoesValue,
    isOmdbLoading,
  );
  const rottenTomatoesUrl = omdbRatingsData?.tomatoURL?.trim() || '';
  const surfaceBackgroundColor = getContrastTint(backgroundColor, 0.28, 0.3);
  const dividerColor = getContrastTint(backgroundColor, 0.32, 0.18);
  const cardBorderColor = getContrastTint(backgroundColor, 0.4, 0.26);

  const onImdbPress = () => {
    if (!imdbId) {
      return;
    }

    const url = `https://www.imdb.com/title/${imdbId}/`;
    console.log('Opening IMDb URL:', url);
    const handlePress = async () => {
      await Linking.openURL(url);
    };

    handlePress();
  };

  const onLetterboxdPress = () => {
    if (!imdbId) {
      return;
    }

    const url = `https://www.letterboxd.com/tmdb/${letterboxdTmdbId}/`;
    console.log('Opening Letterboxd URL:', url);
    const handlePress = async () => {
      await Linking.openURL(url);
    };

    handlePress();
  };

  const onRottenTomatoesPress = () => {
    console.log('Opening Rotten Tomatoes URL:', rottenTomatoesUrl);
    if (!rottenTomatoesUrl) {
      return;
    }

    const handlePress = async () => {
      await Linking.openURL(rottenTomatoesUrl);
    };

    handlePress();
  };

  const onMetacriticPress = () => {
    if (!filmName) {
      return;
    }

    const filmNameSlug = filmName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!filmNameSlug) {
      return;
    }

    const url = `https://www.metacritic.com/movie/${filmNameSlug}`;
    console.log('Opening Metacritic URL:', url);
    const handlePress = async () => {
      await Linking.openURL(url);
    };

    handlePress();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: surfaceBackgroundColor,
          borderColor: cardBorderColor,
        },
      ]}
    >
      {/* IMDb Rating */}
      <View style={styles.ratingItem}>
        <Pressable onPress={onImdbPress}>
          <ImdbRating ratingText={imdbDisplayRating} />
        </Pressable>
      </View>

      {useRottenTomatoesRating ? (
        <View
          style={[
            styles.ratingItem,
            styles.borderLeft,
            { borderColor: dividerColor },
          ]}
        >
          <Pressable onPress={onRottenTomatoesPress}>
            <RottenTomatoRating
              ratingText={rottenTomatoesDisplayRating}
              isRotten={isRotten}
            />
          </Pressable>
        </View>
      ) : (
        <View
          style={[
            styles.ratingItem,
            styles.borderLeft,
            { borderColor: dividerColor },
          ]}
        >
          <Pressable onPress={onMetacriticPress}>
            <MetaCriticRating ratingText={metacriticDisplayRating} />
          </Pressable>
        </View>
      )}

      {/* Letterboxd Rating */}
      <View
        style={[
          styles.ratingItem,
          styles.borderLeft,
          { borderColor: dividerColor },
        ]}
      >
        <Pressable onPress={onLetterboxdPress}>
          <LetterboxdRating movieData={LetterboxdFilmData} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  ratingItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Gap property requires React Native 0.71+
    columnGap: 8,
  },
  borderLeft: {
    borderLeftWidth: 1,
  },
});

export default FilmRatings;
