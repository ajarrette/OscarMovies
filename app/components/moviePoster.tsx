import { Image } from 'expo-image';
import { Pressable } from 'react-native';

type Props = {
  selectedImage?: string;
  width?: number;
  height?: number;
  onPress?: () => void | undefined;
  isCircle?: boolean;
  borderRadius?: number;
};

export default function MoviePoster({
  selectedImage,
  width,
  height,
  onPress,
  isCircle,
  borderRadius: customBorderRadius,
}: Props) {
  const borderRadius =
    customBorderRadius ?? (isCircle ? (width ? width / 2 : 60) : 5);

  return (
    <Pressable onPress={onPress}>
      <Image
        source={selectedImage}
        style={{ width, height, borderRadius }}
        contentFit='cover'
        cachePolicy='memory-disk'
        transition={0}
      />
    </Pressable>
  );
}
