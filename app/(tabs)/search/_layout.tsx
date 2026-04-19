import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function SearchStackLayout() {
  const isIOS = Platform.OS === 'ios';

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isIOS ? 'transparent' : '#25292e',
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        headerTitleStyle: { color: '#fff' },
        headerLargeTitle: isIOS,
        headerLargeTitleStyle: { color: '#fff' },
        headerLargeStyle: {
          backgroundColor: isIOS ? 'transparent' : '#25292e',
        },
        headerTransparent: isIOS,
        headerBlurEffect: isIOS ? 'systemUltraThinMaterialDark' : undefined,
      }}
    >
      <Stack.Screen
        name='index'
        options={{
          title: 'Search',
          headerLargeTitle: isIOS,
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? 'systemUltraThinMaterialDark' : undefined,
          headerShown: true,
        }}
      />
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
