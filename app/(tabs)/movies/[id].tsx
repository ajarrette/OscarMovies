import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Movie() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}
      />

      <Text style={styles.text}>Movie Id: {id}</Text>
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
    gap: 10,
  },
  text: {
    color: '#fff',
  },
});
