import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Dimensions } from 'react-native';
import { useEffect, useState } from 'react';

import MoviePoster from '../components/moviePoster';
import { ImageSizing } from '../services/imageSizing';

type imageSize = {
  width: number;
  height: number;
};

export default function Index() {
  const [imageSize, setImageSize] = useState<imageSize>({
    width: 115,
    height: 173,
  });
  const { width } = useWindowDimensions();

  useEffect(() => {
    const calculatedImageWidth = ImageSizing.getImageSize(110, width - 40, 10);
    const scale = 115 / calculatedImageWidth;
    setImageSize({ width: calculatedImageWidth, height: 173 / scale });
  }, [width]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>BEST PICTURE</Text>
      <ScrollView style={styles.scrollView}>
        <View style={styles.movieList}>
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/7MrgIUeq0DD2iF7GR6wqJfYZNeC.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/lKkWcdqDEPEMVmLxRJGwJxJp5XB.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/5tQYnwYrvr7XhYY7JZYLo7MYIVN.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/vYEyxF1UT779RiEalpMjUT6kfdf.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/7seqaCaaXDNUHOx4DqwpoOH8pPa.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/qNLMPY3KLrYgTX2QZ5iEwwOqyRz.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/lu2vmmtStmTNMmSZl2LgrrQpLZo.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/lqoMzCcZYEFK729d6qzt349fB4o.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg'
            }
            width={imageSize.width}
            height={imageSize.height}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#25292e',
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    gap: 10,
  },
  movieList: {
    width: '100%',
    flex: 1,
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  scrollView: {
    width: '100%',
  },
  text: {
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    width: '100%',
  },
});
