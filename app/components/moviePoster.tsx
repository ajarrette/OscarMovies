import { Image } from 'expo-image';
import { Pressable } from 'react-native';

type Props = {
  selectedImage?: string;
  width?: number;
  height?: number;
  onPress?: () => void | undefined;
};

export default function MoviePoster({
  selectedImage,
  width,
  height,
  onPress,
}: Props) {
  return (
    <Pressable onPress={onPress}>
      <Image
        source={selectedImage}
        style={{ width, height, borderRadius: 5 }}
      />
    </Pressable>
  );
}
