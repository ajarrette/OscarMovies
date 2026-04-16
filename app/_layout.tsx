import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
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
  );
}
