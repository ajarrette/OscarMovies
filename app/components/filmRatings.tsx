import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FreshTomatoIcon from './tomatoFreshIcon';
import LetterboxdRating from './letterboxdRating';

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
        <View style={styles.imdbBadge}>
          <Text style={styles.imdbText}>IMDb</Text>
        </View>
        <Text style={styles.scoreText}>{imdb}</Text>
      </View>

      {/* Rotten Tomatoes Rating */}
      <View style={[styles.ratingItem, styles.borderLeft]}>
        <FreshTomatoIcon size={24} />
        <Text style={styles.scoreText}>{rottenTomatoes}</Text>
      </View>

      {/* Letterboxd Rating */}
      <View style={[styles.ratingItem, styles.borderLeft]}>
        <LetterboxdRating
          tmdbId={1491}
          onRatingFound={(rating) => console.log('Letterboxd rating:', rating)}
        />
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
  imdbBadge: {
    backgroundColor: '#F5C518',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  imdbText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  rtBadge: {
    backgroundColor: '#FA320A',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  rtText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
  },
  scoreText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default FilmRatings;
