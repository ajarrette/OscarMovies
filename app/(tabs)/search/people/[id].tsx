import LoadPersonDetail from '@/app/components/loadPersonDetail';
import { useLocalSearchParams } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

const FILMS_DB_NAME = 'oscar-movies.db';

export default function Person() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <SQLiteProvider
        databaseName={FILMS_DB_NAME}
        assetSource={{
          assetId: require('@/assets/data/oscar-movies.db'),
          forceOverwrite: true,
        }}
        options={{ useNewConnection: true }}
      >
        <LoadPersonDetail id={+id} />
      </SQLiteProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
  },
});
