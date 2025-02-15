import { Stack } from 'expo-router';

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: 'white',
      }}
    >
      <Stack.Screen
        name='index'
        options={{ headerTitle: 'Movies', headerShown: true }}
      />
      <Stack.Screen name='details' options={{ headerTitle: '' }} />
    </Stack>
  );
}
