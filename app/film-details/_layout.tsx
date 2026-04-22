import { Stack } from 'expo-router';
import NominationsHeaderCloseButton from '@/app/components/nominationsHeaderCloseButton';

export default function FilmsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: 'white',
        headerLargeTitle: false,
        contentStyle: { backgroundColor: '#25292e' },
      }}
    >
      <Stack.Screen
        name='[id]'
        options={({ route }) => ({
          headerShown: false,
          contentStyle: { backgroundColor: '#25292e' },
          animationTypeForReplace: 'push',
          animation:
            route.params?.swipeDirection === 'from-left'
              ? 'slide_from_left'
              : 'slide_from_right',
        })}
      />
      <Stack.Screen
        name='[id]/nominations'
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
