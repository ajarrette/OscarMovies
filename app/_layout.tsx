import { Stack } from 'expo-router';
import FilmsDbProvider from './components/filmsDbProvider';

export default function RootLayout() {
  return (
    <FilmsDbProvider>
      <Stack
        initialRouteName='(tabs)'
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: '#25292e' },
        }}
      >
        <Stack.Screen name='(tabs)' options={{ animation: 'none' }} />
        <Stack.Screen
          name='genre-films'
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name='film-details'
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name='film-nominations'
          options={{
            animation: 'slide_from_right',
          }}
        />
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
