import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  fetchOmdbRatingsByImdbId,
  OmdbRatingsData,
} from '../services/omdb-rating-service';
import ImdbRating from './imdbRating';
import LetterboxdRating from './letterboxdRating';
import MetaCriticRating from './metaCriticRating';
import RottenTomatoRating from './rottenTomatoRating';

/**
 * Props definition for the MovieRatings component
 */
interface FilmRatingsProps {
  imdbId: string;
  letterboxdTmdbId: string;
}

const FilmRatings: React.FC<FilmRatingsProps> = ({
  imdbId,
  letterboxdTmdbId,
}) => {
  const [omdbRatingsData, setOmdbRatingsData] =
    useState<OmdbRatingsData | null>(null);
  const [isOmdbLoading, setIsOmdbLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadOmdbRatingsData = async () => {
      if (!imdbId) {
        if (isMounted) {
          setOmdbRatingsData(null);
          setIsOmdbLoading(false);
        }
        return;
      }

      setIsOmdbLoading(true);
      const data = await fetchOmdbRatingsByImdbId(imdbId);

      if (isMounted) {
        setOmdbRatingsData(data);
        setIsOmdbLoading(false);
      }
    };

    loadOmdbRatingsData();

    return () => {
      isMounted = false;
    };
  }, [imdbId]);

  const imdbDisplayRating = useMemo(() => {
    if (isOmdbLoading) {
      return 'Loading...';
    }

    if (
      !omdbRatingsData?.imdbRatingValue ||
      omdbRatingsData.imdbRatingValue === 'N/A'
    ) {
      return 'No rating';
    }

    return `${omdbRatingsData.imdbRatingValue}/10`;
  }, [isOmdbLoading, omdbRatingsData]);

  const rottenTomatoesValue = useMemo(() => {
    if (isOmdbLoading) {
      return null;
    }

    return (
      omdbRatingsData?.ratings.find(
        (rating) => rating.source === 'Rotten Tomatoes',
      )?.value ?? null
    );
  }, [isOmdbLoading, omdbRatingsData]);

  const metacriticValue = useMemo(() => {
    if (isOmdbLoading) {
      return null;
    }

    return (
      omdbRatingsData?.ratings.find((rating) => rating.source === 'Metacritic')
        ?.value ?? null
    );
  }, [isOmdbLoading, omdbRatingsData]);

  const rottenTomatoesDisplayRating = useMemo(() => {
    if (isOmdbLoading) {
      return 'Loading...';
    }

    return rottenTomatoesValue || 'No rating';
  }, [isOmdbLoading, rottenTomatoesValue]);

  const isRottenTomatoesRatingRotten = useMemo(() => {
    if (!rottenTomatoesValue) {
      return false;
    }

    const match = rottenTomatoesValue.match(/(\d+)/);
    if (!match) {
      return false;
    }

    return parseInt(match[1], 10) < 60;
  }, [rottenTomatoesValue]);

  const metacriticDisplayRating = useMemo(() => {
    if (isOmdbLoading) {
      return 'Loading...';
    }

    return metacriticValue || 'No rating';
  }, [isOmdbLoading, metacriticValue]);

  const useRottenTomatoesRating = useMemo(() => {
    if (isOmdbLoading) {
      return true;
    }

    return rottenTomatoesValue ? true : false;
  }, [isOmdbLoading, rottenTomatoesValue]);

  const onImdbPress = () => {
    if (!imdbId) {
      return;
    }

    const url = `https://www.imdb.com/title/${imdbId}/`;
    const handlePress = async () => {
      await Linking.openURL(url);
    };

    handlePress();
  };

  return (
    <View style={styles.container}>
      {/* IMDb Rating */}
      <View style={styles.ratingItem}>
        <Pressable onPress={onImdbPress}>
          <ImdbRating ratingText={imdbDisplayRating} />
        </Pressable>
      </View>

      {useRottenTomatoesRating ? (
        <View style={[styles.ratingItem, styles.borderLeft]}>
          <RottenTomatoRating
            ratingText={rottenTomatoesDisplayRating}
            isRotten={isRottenTomatoesRatingRotten}
          />
        </View>
      ) : (
        <View style={[styles.ratingItem, styles.borderLeft]}>
          <MetaCriticRating ratingText={metacriticDisplayRating} />
        </View>
      )}

      {/* Letterboxd Rating */}
      <View style={[styles.ratingItem, styles.borderLeft]}>
        <LetterboxdRating tmdbId={letterboxdTmdbId} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#3a3f4775',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a5160',
  },
  ratingItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Gap property requires React Native 0.71+
    columnGap: 8,
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderColor: '#fff',
  },
});

export default FilmRatings;
