import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

export default function NominationsHeaderCloseButton() {
  const router = useRouter();
  const { originTab } = useLocalSearchParams<{ originTab?: string }>();

  return (
    <Pressable
      onPress={() => {
        if (originTab === 'search') {
          router.dismissTo('/(tabs)/search');
          return;
        }

        if (originTab === 'genres') {
          router.dismissTo('/(tabs)/genres');
          return;
        }

        router.dismissTo('/(tabs)/films');
      }}
      hitSlop={8}
    >
      <Ionicons name='close' size={22} color='#fff' />
    </Pressable>
  );
}
