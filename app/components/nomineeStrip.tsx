import { Image } from 'expo-image';
import { Pressable } from 'react-native';

type Props = {
  nominations: number;
  wins: number;
  onPress?: () => void | undefined;
};

export default function NomineeStrip({ nominations, wins, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: 10,
        flexWrap: 'wrap',
      }}
    >
      {Array.from({ length: wins }, (_, i) => (
        <Image
          key={i}
          source={require('@/assets/images/winner.png')}
          style={{ width: 25, height: 25, marginTop: 5 }}
        />
      ))}
      {Array.from({ length: nominations - wins }, (_, i) => (
        <Image
          key={i}
          source={require('@/assets/images/nominee.png')}
          style={{ width: 25, height: 25, marginTop: 5 }}
        />
      ))}
    </Pressable>
  );
}
