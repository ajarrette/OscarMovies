import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LetterboxdMovieData } from '../services/letterboxd-film-service';

interface Props {
  movieData: LetterboxdMovieData | null;
}

const LetterboxdRating: React.FC<Props> = ({ movieData }) => {
  const ratingValue = movieData?.rating ?? null;
  const ratingLabel =
    ratingValue === null
      ? 'Loading...'
      : ratingValue !== 'N/A'
        ? `${(+ratingValue).toFixed(1)}/5`
        : 'No rating';

  return (
    <View style={styles.container}>
      <View style={styles.letterboxdIcon}>
        <View style={[styles.dot, { backgroundColor: '#FF8000' }]} />
        <View style={[styles.dot, { backgroundColor: '#00E054' }]} />
        <View style={[styles.dot, { backgroundColor: '#40BCF4' }]} />
      </View>
      <Text style={styles.scoreText}>{ratingLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  scoreText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  letterboxdIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: -2.5, // Creates the signature overlapping look
  },
});

export default LetterboxdRating;
