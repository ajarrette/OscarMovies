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
  roles_csv: string | null;
  displayRoles?: string | null;
};

/**
 * Maps a department name to a specific job title.
 * Returns the original string if no mapping exists.
 */
function getJobTitleFromDepartment(department: string): string {
  const departmentMap: Record<string, string> = {
    Acting: 'Actor',
    Art: 'Artis',
    Camera: 'Camera Operator',
    Directing: 'Director',
    Editing: 'Editor',
    Production: 'Producer',
    Writing: 'Writer',
  };

  return departmentMap[department] ?? department;
}

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
            -- Case 1: The person is in movie_cast
            -- We select 'character' for actors and 'department' for others
            SELECT mc.movie_id AS movie_id,
                  CASE 
                    WHEN mc.department = 'Acting' THEN mc.character 
                    ELSE mc.department 
                  END AS raw_role
            FROM movie_cast mc
            WHERE mc.person_id = ?

            UNION

            -- Case 2: The person directed
            SELECT m.id AS movie_id,
                  'Directing' AS raw_role
            FROM people p
            INNER JOIN movies m
              ON LOWER(TRIM(m.director)) = LOWER(TRIM(p.name))
            WHERE p.id = ?
        )
        SELECT m.id,
              m.title,
              m.poster_path,
              m.popularity,
              -- SQLite uses GROUP_CONCAT to merge rows
              GROUP_CONCAT(DISTINCT pm.raw_role) AS roles_csv
        FROM person_movies pm
        INNER JOIN movies m ON m.id = pm.movie_id
        GROUP BY m.id, m.title, m.poster_path, m.popularity
        ORDER BY COALESCE(m.popularity, 0) DESC,
                m.title ASC`,
          [id, id, id],
        );
      } catch (error) {
        console.error('Error loading movies from movie_cast:', error);
      }

      const formattedMovies = foundMovies.map((movie) => {
        // 1. Split the concatenated roles string into an array
        const roleArray = movie?.roles_csv?.split(',') || [];

        // 2. Map through each role
        const mappedRoles = roleArray.map((role) => {
          // If it's a character name (not a known department), return as is
          // Otherwise, run it through your mapping function
          return getJobTitleFromDepartment(role);
        });

        // 3. Join them back together for display
        return {
          ...movie,
          displayRoles: mappedRoles.join(', '),
        };
      });

      setPerson(foundPerson);
      setMovies(formattedMovies);
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
