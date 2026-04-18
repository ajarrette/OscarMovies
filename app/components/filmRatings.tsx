import React from 'react';
import { StyleSheet, View } from 'react-native';
import ImdbRating from './imdbRating';
import LetterboxdRating from './letterboxdRating';
import RottenTomatoRating from './rottenTomatoRating';

/**
 * Props definition for the MovieRatings component
 */
interface MovieRatingsProps {
  imdb: string;
  rottenTomatoes: string;
  letterboxd: string;
}

const FilmRatings: React.FC<MovieRatingsProps> = ({
  imdb,
  rottenTomatoes,
  letterboxd,
}) => {
  return (
    <View style={styles.container}>
      {/* IMDb Rating */}
      <View style={styles.ratingItem}>
        <ImdbRating imdbId={imdb} />
      </View>

      {/* Rotten Tomatoes Rating */}
      <View style={[styles.ratingItem, styles.borderLeft]}>
        <RottenTomatoRating imdbId={rottenTomatoes} />
      </View>

      {/* Letterboxd Rating */}
      <View style={[styles.ratingItem, styles.borderLeft]}>
        <LetterboxdRating tmdbId={letterboxd} />
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
    backgroundColor: '#3a3f47',
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
