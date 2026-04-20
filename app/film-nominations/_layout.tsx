import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable } from 'react-native';
import NominationsHeaderCloseButton from '@/app/components/nominationsHeaderCloseButton';

export default function FilmNominationsLayout() {
  const isIOS = Platform.OS === 'ios';
  const router = useRouter();

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
        name='[id]'
        options={{
          title: 'Nominations',
          headerBackButtonDisplayMode: 'minimal',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name='chevron-back' size={24} color='#fff' />
            </Pressable>
          ),
          headerRight: () => <NominationsHeaderCloseButton />,
          headerShown: true,
        }}
      />
    </Stack>
  );
}
