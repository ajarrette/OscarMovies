import React from 'react';
import { StyleSheet, View } from 'react-native';
import FilmRatings from '../components/filmRatings';

interface Props {
  tmdbId: string | number;
}

const RatingsScreen: React.FC<Props> = ({ tmdbId }) => {
  return (
    <View style={styles.container}>
      <View style={[styles.ratingsWrapper, { marginTop: 20 }]}>
        <FilmRatings imdb='8.1/10' rottenTomatoes='91%' letterboxd='1124' />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ratingsWrapper: {
    width: '100%',
  },
  ratingBadge: {
    backgroundColor: '#2c3440',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#445566',
  },
  ratingText: {
    color: '#00e054', // The "Letterboxd Green"
    fontWeight: 'bold',
    fontSize: 16,
  },
  hidden: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },
});

export default RatingsScreen;
