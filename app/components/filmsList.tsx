import { router } from 'expo-router';
import { memo, useCallback } from 'react';
import {
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ImageSizing from '../services/imageSizing';
import MoviePoster from './moviePoster';

type CategoryMovie = {
  id: number;
  personId: number | null;
  personProfilePath: string | null;
  title: string;
  posterPath: string | null;
  isWinner: boolean;
  peopleNames: string | null;
  songTitle: string | null;
};

export type CategoryGroup = {
  categoryId: number;
  categoryName: string;
  isPersonFirstCategory: boolean;
  isSongFirstCategory: boolean;
  movies: CategoryMovie[];
};

type Props = {
  categories: CategoryGroup[];
};

const onShowDetails = (id: number) => {
  router.push({
    pathname: '/film-details/[id]',
    params: {
      id: String(id),
      originTab: 'films',
    },
  });
};

const onShowPersonDetails = (id: number) => {
  router.push({
    pathname: '/people/[id]',
    params: {
      id: String(id),
      originTab: 'films',
    },
  });
};

function shouldShowPeopleByCategory(categoryName: string): boolean {
  const normalized = categoryName.trim().toLowerCase();
  return (
    /actor|actress/.test(normalized) ||
    normalized === 'best director' ||
    /screenplay/.test(normalized) ||
    /score/.test(normalized)
  );
}

function shouldShowSongByCategory(categoryName: string): boolean {
  return categoryName.trim().toLowerCase() === 'best original song';
}

function getTmdbListImageUri(path: string | null): string | undefined {
  if (!path) {
    return undefined;
  }

  return `https://image.tmdb.org/t/p/w185${path}`;
}

type CategorySectionProps = {
  item: CategoryGroup;
  posterWidth: number;
  posterHeight: number;
};

const CategorySection = memo(function CategorySection({
  item,
  posterWidth,
  posterHeight,
}: CategorySectionProps) {
  const showPeople = shouldShowPeopleByCategory(item.categoryName);
  const showSong = shouldShowSongByCategory(item.categoryName);

  return (
    <View style={styles.section}>
      <Text style={styles.categoryTitle}>{item.categoryName}</Text>
      <View style={styles.movieList}>
        {item.movies.map((movie, index) => {
          const showCaption =
            (showPeople && movie.peopleNames) || (showSong && movie.songTitle);

          return (
            <View
              key={`${item.categoryId}-${movie.id}-${index}`}
              style={[styles.movieItem, { width: posterWidth }]}
            >
              {(
                item.isPersonFirstCategory
                  ? movie.personProfilePath
                  : movie.posterPath
              ) ? (
                <>
                  <View
                    style={[
                      styles.posterContainer,
                      item.isPersonFirstCategory && {
                        borderRadius: posterWidth / 2,
                      },
                      movie.isWinner && styles.winnerPoster,
                    ]}
                  >
                    <MoviePoster
                      selectedImage={getTmdbListImageUri(
                        item.isPersonFirstCategory
                          ? movie.personProfilePath
                          : movie.posterPath,
                      )}
                      width={movie.isWinner ? posterWidth - 8 : posterWidth}
                      height={
                        item.isPersonFirstCategory
                          ? movie.isWinner
                            ? posterWidth - 8
                            : posterWidth
                          : movie.isWinner
                            ? posterHeight - 8
                            : posterHeight
                      }
                      isCircle={item.isPersonFirstCategory}
                      onPress={() =>
                        item.isPersonFirstCategory && movie.personId !== null
                          ? onShowPersonDetails(movie.personId)
                          : onShowDetails(movie.id)
                      }
                    />
                  </View>
                  {item.isPersonFirstCategory && movie.peopleNames && (
                    <View style={styles.personCaption}>
                      <Pressable
                        onPress={() =>
                          movie.personId !== null
                            ? onShowPersonDetails(movie.personId)
                            : onShowDetails(movie.id)
                        }
                      >
                        <Text style={styles.personName}>
                          {movie.peopleNames}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => onShowDetails(movie.id)}>
                        <Text style={styles.personMovie}>{movie.title}</Text>
                      </Pressable>
                    </View>
                  )}
                  {!item.isPersonFirstCategory && showCaption && (
                    <View style={styles.personCaption}>
                      {showSong && movie.songTitle && (
                        <Text style={styles.personName}>{movie.songTitle}</Text>
                      )}
                      {showPeople && movie.peopleNames && (
                        <Pressable
                          onPress={() =>
                            movie.personId !== null
                              ? onShowPersonDetails(movie.personId)
                              : onShowDetails(movie.id)
                          }
                        >
                          <Text style={styles.personMovie}>
                            {movie.peopleNames}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <Pressable
                  style={[styles.textTile, { height: posterHeight }]}
                  onPress={() =>
                    item.isPersonFirstCategory && movie.personId !== null
                      ? onShowPersonDetails(movie.personId)
                      : onShowDetails(movie.id)
                  }
                >
                  <Text style={styles.movieTitle}>
                    {item.isSongFirstCategory && movie.songTitle
                      ? movie.peopleNames
                        ? `${movie.songTitle} - ${movie.title} - ${movie.peopleNames}`
                        : `${movie.songTitle} - ${movie.title}`
                      : item.isPersonFirstCategory && movie.peopleNames
                        ? `${movie.peopleNames} - ${movie.title}`
                        : movie.peopleNames
                          ? `${movie.title} - ${movie.peopleNames}`
                          : movie.title}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default function FilmsList({ categories }: Props) {
  const { width } = useWindowDimensions();
  const posterWidth = ImageSizing.getImageSize(110, width - 40, 10);
  const posterScale = 115 / posterWidth;
  const posterHeight = 173 / posterScale;

  const renderItem = useCallback<ListRenderItem<CategoryGroup>>(
    ({ item }) => (
      <CategorySection
        item={item}
        posterWidth={posterWidth}
        posterHeight={posterHeight}
      />
    ),
    [posterHeight, posterWidth],
  );

  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => String(item.categoryId)}
      contentContainerStyle={styles.listContent}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      updateCellsBatchingPeriod={80}
      windowSize={4}
      removeClippedSubviews={true}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#25292e',
  },
  section: {
    borderBottomWidth: 1,
    borderColor: '#555',
    paddingBottom: 12,
    marginBottom: 12,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  movieList: {
    width: '100%',
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  posterContainer: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 5,
  },
  movieItem: {
    marginBottom: 8,
  },
  personCaption: {
    gap: 2,
  },
  personMovie: {
    color: '#ccc',
    fontSize: 13,
    width: '100%',
  },
  personName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    width: '100%',
  },
  winnerPoster: {
    borderWidth: 4,
    borderColor: '#ffd33d',
  },
  textTile: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#fff',
    padding: 8,
    justifyContent: 'center',
  },
  movieTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    width: '100%',
  },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});
