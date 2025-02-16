import LoadMovieDetail from '@/app/components/loadMovieDetail';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

export default function Movie() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const onGoBack = () => {
    console.log('i want to go back');
    router.dismiss();
  };

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
        <View style={styles.backButton}>
          <Ionicons
            name='chevron-back-outline'
            onPress={onGoBack}
            size={35}
            color='#ccc'
            backgroundColor='#11111155'
            borderRadius={20}
          />
        </View>
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
});
