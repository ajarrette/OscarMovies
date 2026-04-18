import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FreshTomatoIcon from './tomatoFreshIcon';
import RottenTomatoIcon from './tomatoRottenIcon';

// Define the shape of the OMDb Response
interface OmdbRating {
  Source: string;
  Value: string;
}

interface OmdbData {
  Title: string;
  Year: string;
  Poster: string;
  Ratings: OmdbRating[];
  imdbRating: string;
}

const RottenTomatoRating = ({ imdbId }: { imdbId: string }) => {
  const [rating, setRating] = useState<OmdbData | null>(null);
  const ratingLabel =
    rating === null
      ? 'Loading...'
      : rating?.Ratings.find((r) => r.Source === 'Rotten Tomatoes')?.Value ||
        'No rating';

  // Extract numeric rating to determine which icon to show
  const getRatingValue = (): number | null => {
    if (
      !ratingLabel ||
      ratingLabel === 'Loading...' ||
      ratingLabel === 'No rating'
    ) {
      return null;
    }
    const match = ratingLabel.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  const ratingValue = getRatingValue();
  const isRotten = ratingValue !== null && ratingValue < 60;

  useEffect(() => {
    const fetchMovieData = async () => {
      const apiKey = process.env.EXPO_PUBLIC_OMDB_API_KEY;
      const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`;

      try {
        const response = await fetch(url);
        const result = await response.json();

        if (result.Response === 'False') {
          throw new Error(result.Error || 'Movie not found');
        }

        setRating(result);
      } catch (err) {
        console.log('Error fetching OMDb data:', err);
      } finally {
      }
    };

    fetchMovieData();
  }, [imdbId]);

  return (
    <View style={styles.container}>
      {isRotten ? (
        <RottenTomatoIcon size={24} />
      ) : (
        <FreshTomatoIcon size={24} />
      )}
      <Text style={styles.scoreText}>{ratingLabel}</Text>
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
});

export default RottenTomatoRating;
