import { router } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ImageSizing from '../services/imageSizing';
import MoviePoster from './moviePoster';

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
          <View style={styles.movieList}>
            {item.movies.map((movie, index) => (
              <View
                key={`${item.categoryId}-${movie.id}-${index}`}
                style={[styles.movieItem, { width: posterWidth }]}
              >
                {movie.posterPath ? (
                  <View
                    style={[
                      styles.posterContainer,
                      movie.isWinner && styles.winnerPoster,
                    ]}
                  >
                    <MoviePoster
                      selectedImage={`https://image.tmdb.org/t/p/w300${movie.posterPath}`}
                      width={movie.isWinner ? posterWidth - 8 : posterWidth}
                      height={movie.isWinner ? posterHeight - 8 : posterHeight}
                      onPress={() => onShowDetails(movie.id)}
                    />
                  </View>
                ) : (
                  <Pressable
                    style={[styles.textTile, { height: posterHeight }]}
                    onPress={() => onShowDetails(movie.id)}
                  >
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
                  </Pressable>
                )}
              </View>
            ))}
          </View>
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
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  movieList: {
    width: '100%',
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  posterContainer: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 5,
  },
  movieItem: {
    marginBottom: 8,
  },
  winnerPoster: {
    borderWidth: 4,
    borderColor: '#ffd33d',
  },
  textTile: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#fff',
    padding: 8,
    justifyContent: 'center',
  },
  movieTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    width: '100%',
  },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});
