import { useState } from 'react';
import { Stack } from 'expo-router';
import FilmsDbProvider from './components/filmsDbProvider';
import StartupScreen from './startup';

export default function RootLayout() {
  const [showStartup, setShowStartup] = useState(true);

  return (
    <FilmsDbProvider>
      {showStartup ? (
        <StartupScreen onDone={() => setShowStartup(false)} />
      ) : (
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
            name='people'
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen name='+not-found' options={{ headerShown: true }} />
        </Stack>
      )}
    </FilmsDbProvider>
  );
}
