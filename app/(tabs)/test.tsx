import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

type Movie = {
  title: string;
  tmdb_id: number;
  imdb_id: string;
};

type Nominee = {
  category: string;
  year: string;
  nominees: string[];
  movies: Movie[];
  won: boolean;
};

export default function Test() {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [movies, setMovies] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(true);

  let totalCategoryNominees: any = {};
  useEffect(() => {
    const movieDb = require('../../assets/data/oscar-nominations.json');
    setData(movieDb);

    const categorieSet = new Set<string>();
    const movieSet = new Set<string>();
    console.log('Total nominees', movieDb.length);
    movieDb.forEach((nominee: Nominee) => {
      categorieSet.add(nominee.category);
      nominee.movies.forEach((movie: Movie) => {
        if (movie.imdb_id) {
          movieSet.add(`${movie.title} (${movie.imdb_id})`);
        } else {
          console.log(
            `${movie.title} (${nominee.year}) - (${movie.tmdb_id})  not found`
          );
        }
      });
      let count = totalCategoryNominees[nominee.category] || 0;
      count = count + 1;
      totalCategoryNominees[nominee.category] = count;
    });
    setCategories(Array.from(categorieSet));
    setMovies(Array.from(movieSet));

    setLoading(false);
  }, []);

  if (isLoading) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text>{movies?.length}</Text>
      <ScrollView>
        {movies
          .sort((a, b) => a.localeCompare(b))
          .map((category, index) => (
            <Text key={index}>{category}</Text>
          ))}
      </ScrollView>
    </View>
  );
}
