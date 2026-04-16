import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function PersonNominations() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}
      />

      <Text style={styles.text}>TODO: Person nominations</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    color: '#fff',
    fontSize: 20,
  },
});
