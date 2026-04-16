import { FlatList, StyleSheet, Text, View } from 'react-native';

type CategoryMovie = {
  id: number;
  title: string;
};

export type CategoryGroup = {
  categoryId: number;
  categoryName: string;
  movies: CategoryMovie[];
};

type Props = {
  categories: CategoryGroup[];
};

export default function FilmsList({ categories }: Props) {
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
              <Text style={styles.movieTitle}>{movie.title}</Text>
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
    paddingVertical: 12,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
