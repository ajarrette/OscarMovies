import LoadPersonDetail from '@/app/components/loadPersonDetail';
import { useLocalSearchParams } from 'expo-router';
import FilmsDbProvider from '@/app/components/filmsDbProvider';
import { StyleSheet, View } from 'react-native';

export default function Person() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <FilmsDbProvider>
        <LoadPersonDetail id={+id} />
      </FilmsDbProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
  },
});
