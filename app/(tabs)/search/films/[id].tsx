import LoadFilmDetail from '@/app/components/loadFilmDetail';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function Film() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <LoadFilmDetail id={+id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
  },
});
