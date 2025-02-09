import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Movie = {
  id: number;
  letterbox_id: string;
  imdb_id: string;
  title: string;
  original_title: string;
  oscar_year: number;
  nominations: number;
  wins: number;
};

export default function Search() {
  const [isLoading, setLoading] = useState(true);
  const [data, setData] = useState<Movie[]>([]);

  const getMovies = async () => {
    const headers = new Headers();
    headers.append(
      'apikey',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrem5xYmt6eHJxcWxvZWxucmtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwNTA0NDgsImV4cCI6MjA1NDYyNjQ0OH0.S2AKQDl0aUGTs_Nvle5bbW-0QqBw_elsNhr-jwYFcaY'
    );
    try {
      const response = await fetch(
        'https://lkznqbkzxrqqloelnrko.supabase.co/rest/v1/Movies',
        { headers }
      );
      const movies = (await response.json()) as Movie[];
      setData(
        movies.sort((a: Movie, b: Movie) => a.title.localeCompare(b.title))
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMovies();
  }, []);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={data}
          keyExtractor={({ id }) => id.toString()}
          renderItem={({ item }) => (
            <Text style={styles.item}>{item.title}</Text>
          )}
        />
      )}
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
  },
  item: {
    color: '#fff',
    padding: 10,
    fontSize: 18,
    height: 44,
  },
  text: {
    color: '#fff',
  },
});
