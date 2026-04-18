import { StyleSheet, Text, View } from 'react-native';

type ImdbRatingProps = {
  ratingText: string;
};

const ImdbRating = ({ ratingText }: ImdbRatingProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.imdbBadge}>
        <Text style={styles.imdbText}>IMDb</Text>
      </View>
      <Text style={styles.scoreText}>{ratingText}</Text>
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
  text: { fontSize: 16, fontWeight: 'bold' },
  scoreText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
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
});

export default ImdbRating;
