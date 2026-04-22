import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import Film from '@/types/film';
import { ensureAllPopularityCachesFresh } from '@/app/services/popularity';
import FilmDetail from './filmDetail';

type Props = {
  id: number;
  nominationsPath?:
    | '/film-nominations/[id]'
    | '/film-details/[id]/nominations'
    | '/genre-films/films/[id]/nominations'
    | '/(tabs)/genres/films/[id]/nominations';
};

type PersonMatch = {
  id: number;
};

export type FilmCastPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number | null;
  known_for_department: string | null;
  character: string | null;
};

type FilmGenreRow = {
  name: string;
};

export default function LoadFilmDetail({ id, nominationsPath }: Props) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [film, setFilm] = useState<Film | null>(null);
  const [directorPersonId, setDirectorPersonId] = useState<number | null>(null);
  const [castPeople, setCastPeople] = useState<FilmCastPerson[]>([]);

  useEffect(() => {
    const loadFilm = async () => {
      await ensureAllPopularityCachesFresh(db);

      const foundFilmRecord = await db.getFirstAsync<Film | null>(
        `SELECT m.*,
                COALESCE(mpc.popularity, 0) AS popularity
         FROM movies m
         LEFT JOIN movie_popularity_cache mpc ON mpc.tmdb_id = m.tmdb_id
         WHERE m.id = ?`,
        [id],
      );

      let foundFilm = foundFilmRecord;

      if (foundFilmRecord) {
        let foundGenres: FilmGenreRow[] = [];

        try {
          foundGenres = await db.getAllAsync<FilmGenreRow>(
            `SELECT g.name
             FROM movie_tmdb_genres mg
             INNER JOIN tmdb_genres g ON g.id = mg.genre_id
             WHERE mg.movie_id = ?
             ORDER BY g.name COLLATE NOCASE ASC`,
            [id],
          );
        } catch (error) {
          console.warn('Error loading genres from movie_tmdb_genres:', error);
        }

        foundFilm = {
          ...foundFilmRecord,
          genres: foundGenres.map((genre) => genre.name),
        };
      }

      let foundCast: FilmCastPerson[] = [];

      try {
        foundCast = await db.getAllAsync<FilmCastPerson>(
          `SELECT mc.character,
              p.id,
              p.name,
              p.profile_path,
                COALESCE(ppc.popularity, 0) AS popularity,
              p.known_for_department
          FROM movie_cast mc
          INNER JOIN people p ON p.id = mc.person_id
            LEFT JOIN people_popularity_cache ppc ON ppc.tmdb_id = p.tmdb_id
          WHERE mc.movie_id = ? 
            AND mc.department = 'Acting'
          ORDER BY mc.cast_order ASC,
              COALESCE(ppc.popularity, 0) DESC,
                  p.name ASC
          LIMIT 12`,
          [id],
        );
      } catch (error) {
        console.error('Error loading cast from movie_cast:', error);
      }

      setCastPeople(foundCast);

      if (foundFilm?.director) {
        const foundPerson = await db.getFirstAsync<PersonMatch | null>(
          'SELECT id FROM people WHERE name = ?',
          [foundFilm.director],
        );
        setDirectorPersonId(foundPerson?.id ?? null);
      } else {
        setDirectorPersonId(null);
      }

      setFilm(foundFilm);
      setLoading(false);
    };
    loadFilm();
  }, [db, id]);

  const loadFilm = () => {
    console.log('loading film');
  };

  return (
    <>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='small' color='#fff' />
        </View>
      ) : film ? (
        <FilmDetail
          film={film}
          directorPersonId={directorPersonId}
          castPeople={castPeople}
          nominationsPath={nominationsPath}
        />
      ) : (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={styles.text}>Not found</Text>
          <Button onPress={loadFilm} title='Load film' />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25292e',
  },
  text: {
    color: '#fff',
  },
});
