import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

type MetacriticRatingProps = {
  ratingText: string;
};

const MetaCriticRating = ({ ratingText }: MetacriticRatingProps) => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/icons/mt-icon.svg')}
        style={styles.icon}
      />
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
  icon: {
    width: 24,
    height: 24,
  },
  scoreText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
});

export default MetaCriticRating;
