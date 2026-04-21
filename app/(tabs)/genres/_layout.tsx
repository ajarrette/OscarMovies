import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import NominationsHeaderCloseButton from '@/app/components/nominationsHeaderCloseButton';

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
        options={({ route }) => ({
          headerShown: false,
          gestureEnabled: false,
          animationTypeForReplace: 'push',
          animation:
            route.params?.swipeDirection === 'from-left'
              ? 'slide_from_left'
              : 'slide_from_right',
        })}
      />
      <Stack.Screen
        name='films/[id]/nominations'
        options={{
          title: 'Nominations',
          headerTitle: 'Nominations',
          headerLargeTitle: true,
          headerTransparent: false,
          headerBlurEffect: undefined,
          headerStyle: { backgroundColor: '#25292e' },
          headerTitleStyle: { color: '#fff' },
          headerLargeTitleStyle: { color: '#fff' },
          headerLargeStyle: { backgroundColor: '#25292e' },
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => <NominationsHeaderCloseButton />,
          headerShown: true,
        }}
      />
    </Stack>
  );
}
