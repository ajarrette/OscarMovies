import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const ImdbRating = ({ imdbId }: { imdbId: string }) => {
  const [rating, setRating] = useState<string | null>(null);
  const ratingLabel =
    rating === null
      ? 'Loading...'
      : rating !== 'N/A'
        ? `${rating}/10`
        : 'No rating';

  // This script runs INSIDE the IMDb webpage
  const injectedJavaScript = `
    (function() {
      function getRating() {
        // Try Strategy 1: JSON-LD
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          const data = JSON.parse(jsonLd.innerText);
          if (data.aggregateRating) return data.aggregateRating.ratingValue;
        }

        // Try Strategy 2: Text lookup (Plan B)
        const ratingElement = document.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span');
        if (ratingElement) return ratingElement.innerText;

        return null;
      }

      // Send the result back to React Native
      window.ReactNativeWebView.postMessage(getRating());
    })();
    true; // Required for injectedJS to work
  `;

  const onMessage = (event: WebViewMessageEvent) => {
    const scrapedRating = event.nativeEvent.data;
    if (scrapedRating && scrapedRating !== 'null') {
      setRating(scrapedRating);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.imdbBadge}>
        <Text style={styles.imdbText}>IMDb</Text>
      </View>
      <Text style={styles.scoreText}>{ratingLabel}</Text>

      {/* Hidden WebView */}
      <View style={styles.hidden}>
        <WebView
          source={{ uri: `https://www.imdb.com/title/${imdbId}/` }}
          injectedJavaScript={injectedJavaScript}
          onMessage={onMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // Start injecting as soon as the DOM is ready
          injectedJavaScriptBeforeContentLoaded={`window.isScraper = true;`}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  text: { fontSize: 16, fontWeight: 'bold' },
  hidden: { height: 0, width: 0, opacity: 0 }, // Hide it completely
  scoreText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  imdbBadge: {
    backgroundColor: '#F5C518',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  imdbText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
});

export default ImdbRating;
