import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function GenresStackLayout() {
  const isIOS = Platform.OS === 'ios';

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isIOS ? 'transparent' : '#25292e',
        },
        headerShadowVisible: false,
        headerTintColor: 'white',
        headerTitleStyle: {
          color: '#fff',
        },
        headerLargeTitle: isIOS,
        headerLargeTitleStyle: {
          color: '#fff',
        },
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
          title: 'Genres',
          headerLargeTitle: isIOS,
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? 'systemUltraThinMaterialDark' : undefined,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name='[genreId]'
        options={{
          title: 'Genre',
          headerLargeTitle: isIOS,
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? 'systemUltraThinMaterialDark' : undefined,
          headerBackButtonDisplayMode: 'minimal',
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
    </Stack>
  );
}
