import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MoviePoster from '../components/moviePoster';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>BEST PICTURE</Text>
      <ScrollView style={styles.scrollView}>
        <View style={styles.movieList}>
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/7MrgIUeq0DD2iF7GR6wqJfYZNeC.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/lKkWcdqDEPEMVmLxRJGwJxJp5XB.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/5tQYnwYrvr7XhYY7JZYLo7MYIVN.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/vYEyxF1UT779RiEalpMjUT6kfdf.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/7seqaCaaXDNUHOx4DqwpoOH8pPa.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/qNLMPY3KLrYgTX2QZ5iEwwOqyRz.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/lu2vmmtStmTNMmSZl2LgrrQpLZo.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/lqoMzCcZYEFK729d6qzt349fB4o.jpg'
            }
          />
          <MoviePoster
            selectedImage={
              'https://image.tmdb.org/t/p/w300/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg'
            }
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
    gap: 20,
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
