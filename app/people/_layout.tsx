import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function PeopleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: 'white',
      }}
    >
      <Stack.Screen
        name='[id]'
        options={{
          headerStyle: { backgroundColor: 'transparent' },
          headerTransparent: true,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
          headerBackground: () => (
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          ),
        }}
      />
      <Stack.Screen
        name='[id]/nominations'
        options={{ headerTitle: 'Nominations' }}
      />
    </Stack>
  );
}
