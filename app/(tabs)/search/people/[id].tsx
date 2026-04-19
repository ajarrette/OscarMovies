import LoadPersonDetail from '@/app/components/loadPersonDetail';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function Person() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <LoadPersonDetail id={+id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
  },
});
