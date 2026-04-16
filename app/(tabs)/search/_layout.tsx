import { Stack } from 'expo-router';

export default function SearchStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name='index' />
      <Stack.Screen
        name='films/[id]'
        options={{
          headerStyle: { backgroundColor: 'transparent' },
          headerTransparent: true,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='people/[id]'
        options={{
          headerStyle: { backgroundColor: 'transparent' },
          headerTransparent: true,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='films/[id]/nominations'
        options={{
          headerTitle: 'Nominations',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='people/[id]/nominations'
        options={{
          headerTitle: 'Nominations',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
