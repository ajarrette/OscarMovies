import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

type Props = {
  selectedImage?: string;
};

export default function MoviePoster({ selectedImage }: Props) {
  return <Image source={selectedImage} style={styles.image} />;
}

const styles = StyleSheet.create({
  image: {
    width: 115,
    height: 173,
    borderRadius: 5,
  },
});
