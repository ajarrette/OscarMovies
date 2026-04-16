import { FlatList, StyleSheet, Text, View } from 'react-native';

type FilmRow = {
  id: number;
  title: string;
  nominations: number;
};

type Props = {
  films: FilmRow[];
};

export default function FilmsList({ films }: Props) {
  return (
    <FlatList
      data={films}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{item.title}</Text>
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
  row: {
    borderBottomWidth: 1,
    borderColor: '#555',
    paddingVertical: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
