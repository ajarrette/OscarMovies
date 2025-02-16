import LoadMovieDetail from '@/app/components/loadMovieDetail';
import { useLocalSearchParams } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

export default function Movie() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <SQLiteProvider
        databaseName='oscarmovies.db'
        assetSource={{
          assetId: require('@/assets/data/oscarmovies.db'),
          forceOverwrite: true,
        }}
        options={{ useNewConnection: true }}
      >
        <LoadMovieDetail id={+id} />
      </SQLiteProvider>
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
