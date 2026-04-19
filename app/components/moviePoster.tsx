import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

const WINNER_IMAGE = require('../../assets/images/winner.png');
const NOMINEE_IMAGE = require('../../assets/images/nominee.png');

type Props = {
  selectedImage?: string;
  width?: number;
  height?: number;
  onPress?: () => void | undefined;
  isCircle?: boolean;
  borderRadius?: number;
  wins?: number;
  nominations?: number;
};

export default function MoviePoster({
  selectedImage,
  width,
  height,
  onPress,
  isCircle,
  borderRadius: customBorderRadius,
  wins,
  nominations,
}: Props) {
  const borderRadius =
    customBorderRadius ?? (isCircle ? (width ? width / 2 : 60) : 5);

  const showWinner = !isCircle && (wins ?? 0) > 0;
  const showNominee = !isCircle && !showWinner && (nominations ?? 0) > 0;
  const showBadge = showWinner || showNominee;
  const badgeSize = Math.round(
    Math.min(Math.max((width ?? 60) * 0.28, 18), 48),
  );

  return (
    <Pressable onPress={onPress}>
      <View style={{ width, height }}>
        <Image
          source={selectedImage}
          style={{ width, height, borderRadius }}
          contentFit='cover'
          cachePolicy='memory-disk'
          transition={0}
        />
        {showBadge && (
          <Image
            source={showWinner ? WINNER_IMAGE : NOMINEE_IMAGE}
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: badgeSize,
              height: badgeSize,
            }}
            contentFit='contain'
          />
        )}
      </View>
    </Pressable>
  );
}
