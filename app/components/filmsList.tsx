import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import MoviePoster from './moviePoster';
import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import ImageSizing from '../services/imageSizing';

type CategoryMovie = {
  id: number;
  title: string;
  posterPath: string | null;
  isWinner: boolean;
  peopleNames: string | null;
  songTitle: string | null;
};

export type CategoryGroup = {
  categoryId: number;
  categoryName: string;
  isPersonFirstCategory: boolean;
  isSongFirstCategory: boolean;
  movies: CategoryMovie[];
};

type Props = {
  categories: CategoryGroup[];
};

const onShowDetails = (id: number) => {
  router.push(`/films/${id}`);
};

export default function FilmsList({ categories }: Props) {
  const { width } = useWindowDimensions();
  const posterWidth = ImageSizing.getImageSize(110, width - 40, 10);
  const posterScale = 115 / posterWidth;
  const posterHeight = 173 / posterScale;

  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => String(item.categoryId)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.section}>
          <Text style={styles.categoryTitle}>{item.categoryName}</Text>
          {item.movies.map((movie, index) => (
            <View
              key={`${item.categoryId}-${movie.id}-${index}`}
              style={styles.movieRow}
            >
              {movie.isWinner && (
                <Image
                  source={require('../../assets/images/winner.png')}
                  style={styles.winnerIcon}
                />
              )}
              {movie.posterPath ? (
                <MoviePoster
                  selectedImage={`https://image.tmdb.org/t/p/w300${movie.posterPath}`}
                  width={posterWidth}
                  height={posterHeight}
                  onPress={() => onShowDetails(movie.id)}
                />
              ) : (
                <Text style={styles.movieTitle}>
                  {item.isSongFirstCategory && movie.songTitle
                    ? movie.peopleNames
                      ? `${movie.songTitle} - ${movie.title} - ${movie.peopleNames}`
                      : `${movie.songTitle} - ${movie.title}`
                    : item.isPersonFirstCategory && movie.peopleNames
                      ? `${movie.peopleNames} - ${movie.title}`
                      : movie.peopleNames
                        ? `${movie.title} - ${movie.peopleNames}`
                        : movie.title}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#25292e',
  },
  section: {
    borderBottomWidth: 1,
    borderColor: '#555',
    paddingBottom: 12,
    marginBottom: 12,
  },
  categoryTitle: {
    color: '#ffd33d',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  winnerIcon: {
    width: 16,
    height: 16,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
