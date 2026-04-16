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
  const [movies, setMovies] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const movieDb =
      require('../../assets/data/oscar-nominations.json') as Nominee[];

    const movieSet = new Set<string>();
    const movieList = new Set<number>();
    const totalCategoryNominees: Record<string, number> = {};
    console.log('Total nominees', movieDb.length);
    movieDb.forEach((nominee: Nominee) => {
      nominee.movies.forEach((movie: Movie) => {
        if (+nominee.year === 2019) {
          movieList.add(movie.tmdb_id);
        }
        if (movie.imdb_id) {
          movieSet.add(`${movie.title} (${movie.imdb_id})`);
        } else {
          console.log(
            `${movie.title} (${nominee.year}) - (${movie.tmdb_id})  not found`,
          );
        }
      });
      let count = totalCategoryNominees[nominee.category] || 0;
      count = count + 1;
      totalCategoryNominees[nominee.category] = count;
    });
    setMovies(Array.from(movieSet));

    console.log(movieList);

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
