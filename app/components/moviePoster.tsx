import { Image } from 'expo-image';

type Props = {
  selectedImage?: string;
  width?: number;
  height?: number;
};

export default function MoviePoster({ selectedImage, width, height }: Props) {
  return (
    <Image source={selectedImage} style={{ width, height, borderRadius: 5 }} />
  );
}
