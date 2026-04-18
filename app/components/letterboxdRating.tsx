import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getCachedRating, setCachedRating } from '../utils/ratingCache';

interface Props {
  tmdbId: string | number;
  onRatingFound?: (rating: string) => void;
}

const LetterboxdRating: React.FC<Props> = ({ tmdbId, onRatingFound }) => {
  const [rating, setRating] = useState<string | null>(null);
  const [shouldScrape, setShouldScrape] = useState<boolean>(true);
  const webViewRef = useRef<WebView>(null);
  const ratingLabel =
    rating === null
      ? 'Loading...'
      : rating !== 'N/A'
        ? `${(+rating).toFixed(1)}/5`
        : 'No rating';

  const scraperJS = `
    (function() {
      function findRating() {
        // 1. Check JSON-LD Metadata
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          const match = jsonLd.innerHTML.match(/"ratingValue":\\s*([\\d.]+)/);
          if (match) return match[1];
        }
        
        // 2. Fallback to Twitter Meta Tags
        const meta = document.querySelector('meta[name="twitter:data2"]');
        if (meta) {
          const val = meta.getAttribute('content');
          if (val) return val.split(' ')[0];
        }

        return null;
      }

      let attempts = 0;
      const interval = setInterval(() => {
        const score = findRating();
        attempts++;
        
        // We stop after 15 attempts (7.5 seconds)
        if (score || attempts > 15) {
          window.ReactNativeWebView.postMessage(score || "N/A");
          clearInterval(interval);
        }
      }, 500);
    })();
    true;
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    const result = event.nativeEvent.data;
    setRating(result);
    if (onRatingFound) {
      onRatingFound(result);
    }
    // Cache the rating
    setCachedRating(`letterboxd_${tmdbId}`, result);
  };

  // Check cache on mount
  useEffect(() => {
    const loadFromCacheOrScrape = async () => {
      const cacheKey = `letterboxd_${tmdbId}`;
      const cachedRating = await getCachedRating(cacheKey);

      if (cachedRating) {
        // Cache hit, use cached value
        setRating(cachedRating);
        if (onRatingFound) {
          onRatingFound(cachedRating);
        }
        setShouldScrape(false);
      } else {
        // Cache miss, will scrape
        setShouldScrape(true);
      }
    };

    loadFromCacheOrScrape();
  }, [tmdbId, onRatingFound]);

  return (
    <View style={styles.container}>
      <View style={styles.letterboxdIcon}>
        <View style={[styles.dot, { backgroundColor: '#FF8000' }]} />
        <View style={[styles.dot, { backgroundColor: '#00E054' }]} />
        <View style={[styles.dot, { backgroundColor: '#40BCF4' }]} />
      </View>
      <Text style={styles.scoreText}>{ratingLabel}</Text>

      {/* Hidden WebView: only load if we need to scrape (cache miss) */}
      {shouldScrape && (
        <View style={styles.hidden}>
          <WebView
            ref={webViewRef}
            source={{ uri: `https://letterboxd.com/tmdb/${tmdbId}/` }}
            injectedJavaScript={scraperJS}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            incognito={true} // Bypasses cache and shared cookies
            startInLoadingState={true}
            userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
            onShouldStartLoadWithRequest={(request) => {
              // Silently block about:srcdoc navigations (from inline iframes on Letterboxd)
              // to suppress "Can't open url" console warnings
              return !request.url.startsWith('about:');
            }}
          />
        </View>
      )}
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
  hidden: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },

  scoreText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  letterboxdIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: -2.5, // Creates the signature overlapping look
  },
});

export default LetterboxdRating;
