import { Stack } from 'expo-router';

export default function PeopleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: 'white',
        contentStyle: { backgroundColor: '#25292e' },
      }}
    >
      <Stack.Screen
        name='[id]'
        options={{
          headerStyle: { backgroundColor: 'transparent' },
          headerTransparent: true,
          title: '',
          headerTitle: () => null,
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='[id]/nominations'
        options={{ headerTitle: 'Nominations' }}
      />
    </Stack>
  );
}
