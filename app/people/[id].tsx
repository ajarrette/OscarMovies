import LoadPersonDetail from '../components/loadPersonDetail';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function Person() {
  const { id } = useLocalSearchParams();

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <LoadPersonDetail id={+id} />
    </>
  );
}
