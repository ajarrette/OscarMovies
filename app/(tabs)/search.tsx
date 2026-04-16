import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Search() {
  return (
    <View style={styles.container}>
      <Tabs.Screen options={{}} />
      <Text style={styles.placeholder}>Search coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#fff',
  },
});
