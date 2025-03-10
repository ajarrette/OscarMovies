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
        options={{
          headerTitle: '2025',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='[id]'
        options={{
          headerStyle: { backgroundColor: 'transparent' },
          headerTransparent: true,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='[id]/nominations'
        options={{ headerTitle: 'Nominations 2' }}
      />
    </Stack>
  );
}
