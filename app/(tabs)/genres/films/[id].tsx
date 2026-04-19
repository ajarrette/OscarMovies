import LoadFilmDetail from '@/app/components/loadFilmDetail';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function GenreFilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const filmId = Number(id ?? '0');

  return (
    <View style={styles.container}>
      <LoadFilmDetail id={filmId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 10,
  },
});
