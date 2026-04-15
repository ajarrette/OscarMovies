import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function Nominations() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}
      />

      <Text style={styles.text}>TODO: Nominations</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
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
