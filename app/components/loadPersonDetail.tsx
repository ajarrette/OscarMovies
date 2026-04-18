import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import Person from '@/types/person';
import PersonDetail from './personDetail';

type Props = {
  id: number;
};

export type PersonMovie = {
  id: number;
  title: string;
  poster_path: string | null;
  popularity: number | null;
};

export default function LoadPersonDetail({ id }: Props) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<Person | null>(null);
  const [movies, setMovies] = useState<PersonMovie[]>([]);

  useEffect(() => {
    const loadPerson = async () => {
      const foundPerson = await db.getFirstAsync<Person | null>(
        `SELECT p.id,
                p.name,
                p.tmdb_id,
                p.imdb_id,
                p.biography,
                p.birthday,
                p.deathday,
                p.gender,
                p.known_for_department,
                p.place_of_birth,
                p.popularity,
                p.profile_path,
                COALESCE(p.nominations, 0) AS nominations,
                COALESCE(p.wins, 0) AS wins
         FROM people p
         WHERE p.id = ?`,
        [id],
      );

      let foundMovies: PersonMovie[] = [];

      try {
        foundMovies = await db.getAllAsync<PersonMovie>(
          `WITH person_movies AS (
             SELECT mc.movie_id AS movie_id
             FROM movie_cast mc
             WHERE mc.person_id = ?

             UNION

             SELECT nm.movie_id AS movie_id
             FROM nomination_people np
             INNER JOIN nomination_movies nm ON nm.nomination_id = np.nomination_id
             WHERE np.person_id = ?

             UNION

             SELECT m.id AS movie_id
             FROM people p
             INNER JOIN movies m
               ON LOWER(TRIM(m.director)) = LOWER(TRIM(p.name))
             WHERE p.id = ?
           )
           SELECT DISTINCT m.id,
                  m.title,
                  m.poster_path,
                  m.popularity
           FROM person_movies pm
           INNER JOIN movies m ON m.id = pm.movie_id
           ORDER BY COALESCE(m.popularity, 0) DESC,
                    m.title ASC`,
          [id, id, id],
        );
      } catch (error) {
        console.error('Error loading movies from movie_cast:', error);
      }

      setPerson(foundPerson);
      setMovies(foundMovies);
      setLoading(false);
    };

    loadPerson();
  }, [db, id]);

  const loadPerson = () => {
    console.log('loading person');
  };

  return (
    <>
      {loading ? (
        <></>
      ) : person ? (
        <PersonDetail person={person} movies={movies} />
      ) : (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={styles.text}>Not found</Text>
          <Button onPress={loadPerson} title='Load person' />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#fff',
  },
});
