import { Tabs } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';
import LoadMovies from '../components/loadMovies';

export default function Search() {
  return (
    <View style={styles.container}>
      <Tabs.Screen options={{}} />
      <SQLiteProvider
        databaseName='movies.db'
        assetSource={{
          assetId: require('@/assets/data/movies.db'),
          forceOverwrite: true,
        }}
        options={{ useNewConnection: true }}
      >
        <LoadMovies />
      </SQLiteProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
  },
});
