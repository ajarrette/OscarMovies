import { StyleSheet, Text, View } from 'react-native';
import FreshTomatoIcon from './tomatoFreshIcon';
import RottenTomatoIcon from './tomatoRottenIcon';

type RottenTomatoRatingProps = {
  ratingText: string;
  isRotten: boolean;
};

const RottenTomatoRating = ({
  ratingText,
  isRotten,
}: RottenTomatoRatingProps) => {
  return (
    <View style={styles.container}>
      {isRotten ? (
        <RottenTomatoIcon size={24} />
      ) : (
        <FreshTomatoIcon size={24} />
      )}
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
});

export default RottenTomatoRating;
