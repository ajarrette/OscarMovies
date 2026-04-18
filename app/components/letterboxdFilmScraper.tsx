import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  LETTERBOXD_MOVIE_DATA_SCRAPER_JS,
  setCachedLetterboxdFilmData,
  type LetterboxdFilmData,
} from '../services/letterboxd-film-service';

type Props = {
  tmdbId: string | number;
  enabled: boolean;
  onMovieDataFound: (data: LetterboxdFilmData) => void;
};

const LetterboxdFilmScraper: React.FC<Props> = ({
  tmdbId,
  enabled,
  onMovieDataFound,
}) => {
  if (!enabled) {
    return null;
  }

  const handleMessage = (event: WebViewMessageEvent) => {
    console.log('Received message from WebView:', event.nativeEvent);
    const result = event.nativeEvent.data || 'N/A';
    const movieData: LetterboxdFilmData = { rating: result };
    onMovieDataFound(movieData);
    void setCachedLetterboxdFilmData(tmdbId, movieData);
  };

  return (
    <View style={styles.hidden} pointerEvents='none'>
      <WebView
        source={{ uri: `https://letterboxd.com/tmdb/${tmdbId}/` }}
        injectedJavaScript={LETTERBOXD_MOVIE_DATA_SCRAPER_JS}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        incognito={true}
        startInLoadingState={true}
        userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
        onShouldStartLoadWithRequest={(request) =>
          !request.url.startsWith('about:')
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },
});

export default LetterboxdFilmScraper;
