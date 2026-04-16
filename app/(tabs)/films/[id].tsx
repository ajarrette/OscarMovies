import LoadFilmDetail from '../../components/loadFilmDetail';
import { useLocalSearchParams } from 'expo-router';
import FilmsDbProvider from '../../components/filmsDbProvider';
import { StyleSheet, View } from 'react-native';

export default function Film() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <FilmsDbProvider>
        <LoadFilmDetail id={+id} />
      </FilmsDbProvider>
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
