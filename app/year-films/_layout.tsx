import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function YearFilmsStackLayout() {
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
        name='[year]'
        options={{
          title: 'Year',
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
    </Stack>
  );
}
