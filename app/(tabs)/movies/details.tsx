import { StyleSheet, Text, View } from 'react-native';

export default function Details() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Details</Text>
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
