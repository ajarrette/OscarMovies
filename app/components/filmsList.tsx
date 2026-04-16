import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

type CategoryMovie = {
  id: number;
  title: string;
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
              {movie.isWinner && (
                <Image
                  source={require('../../assets/images/winner.png')}
                  style={styles.winnerIcon}
                />
              )}
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
