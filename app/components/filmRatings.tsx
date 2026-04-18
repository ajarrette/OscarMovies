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

/**
 * Props definition for the MovieRatings component
 */
interface FilmRatingsProps {
  imdbId: string;
  letterboxdTmdbId: string;
  omdbRatingsData: OmdbRatingsData | null;
  isOmdbLoading: boolean;
}

const FilmRatings: React.FC<FilmRatingsProps> = ({
  imdbId,
  letterboxdTmdbId,
  omdbRatingsData,
  isOmdbLoading,
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

  const onImdbPress = () => {
    if (!imdbId) {
      return;
    }

    const url = `https://www.imdb.com/title/${imdbId}/`;
    const handlePress = async () => {
      await Linking.openURL(url);
    };

    handlePress();
  };

  return (
    <View style={styles.container}>
      {/* IMDb Rating */}
      <View style={styles.ratingItem}>
        <Pressable onPress={onImdbPress}>
          <ImdbRating ratingText={imdbDisplayRating} />
        </Pressable>
      </View>

      {useRottenTomatoesRating ? (
        <View style={[styles.ratingItem, styles.borderLeft]}>
          <RottenTomatoRating
            ratingText={rottenTomatoesDisplayRating}
            isRotten={isRotten}
          />
        </View>
      ) : (
        <View style={[styles.ratingItem, styles.borderLeft]}>
          <MetaCriticRating ratingText={metacriticDisplayRating} />
        </View>
      )}

      {/* Letterboxd Rating */}
      <View style={[styles.ratingItem, styles.borderLeft]}>
        <LetterboxdRating tmdbId={letterboxdTmdbId} />
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
    backgroundColor: '#3a3f4775',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a5160',
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
    borderColor: '#fff',
  },
});

export default FilmRatings;
