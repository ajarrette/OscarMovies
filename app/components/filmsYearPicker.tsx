import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  decades: number[];
  yearsInSelectedDecade: number[];
  selectedDecade: number | null;
  selectedYear: number | null;
  onSelectDecade: (decade: number) => void;
  onSelectYear: (year: number) => void;
};

export default function FilmsYearPicker({
  decades,
  yearsInSelectedDecade,
  selectedDecade,
  selectedYear,
  onSelectDecade,
  onSelectYear,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Decade</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {decades.map((decade) => {
            const isSelected = decade === selectedDecade;

            return (
              <Pressable
                key={String(decade)}
                style={[styles.pill, isSelected && styles.pillSelected]}
                onPress={() => onSelectDecade(decade)}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected && styles.pillTextSelected,
                  ]}
                >
                  {decade}s
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Text style={styles.label}>Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {yearsInSelectedDecade.map((year) => {
            const isSelected = year === selectedYear;

            return (
              <Pressable
                key={String(year)}
                style={[styles.pill, isSelected && styles.pillSelected]}
                onPress={() => onSelectYear(year)}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected && styles.pillTextSelected,
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#555',
  },
  label: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#666',
  },
  pillSelected: {
    backgroundColor: '#ffd33d',
    borderColor: '#ffd33d',
  },
  pillText: {
    color: '#fff',
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#25292e',
  },
});
