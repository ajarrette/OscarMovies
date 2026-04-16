import { Image } from 'expo-image';
import { Pressable } from 'react-native';

type Props = {
  selectedImage?: string;
  width?: number;
  height?: number;
  onPress?: () => void | undefined;
  isCircle?: boolean;
};

export default function MoviePoster({
  selectedImage,
  width,
  height,
  onPress,
  isCircle,
}: Props) {
  const borderRadius = isCircle ? (width ? width / 2 : 60) : 5;

  return (
    <Pressable onPress={onPress}>
      <Image source={selectedImage} style={{ width, height, borderRadius }} />
    </Pressable>
  );
}
