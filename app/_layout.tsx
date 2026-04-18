import { Stack } from 'expo-router';
import FilmsDbProvider from './components/filmsDbProvider';

export default function RootLayout() {
  return (
    <FilmsDbProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(tabs)' />
        <Stack.Screen
          name='people'
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen name='+not-found' options={{ headerShown: true }} />
      </Stack>
    </FilmsDbProvider>
  );
}
