import MovieDetail from '@/app/components/movieDetail';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

export default function Movie() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}
      />

      <SQLiteProvider
        databaseName='oscarmovies.db'
        assetSource={{ assetId: require('@/assets/data/oscarmovies.db') }}
      >
        <MovieDetail id={+id} />
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
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    gap: 10,
  },
});
