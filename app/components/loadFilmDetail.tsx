import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import Film from '@/types/film';
import FilmDetail from './filmDetail';

type Props = {
  id: number;
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
};

export default function LoadFilmDetail({ id }: Props) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [film, setFilm] = useState<Film | null>(null);
  const [directorPersonId, setDirectorPersonId] = useState<number | null>(null);
  const [castPeople, setCastPeople] = useState<FilmCastPerson[]>([]);

  useEffect(() => {
    const loadFilm = async () => {
      const foundFilm = await db.getFirstAsync<Film | null>(
        'SELECT * FROM movies WHERE id = ?',
        [id],
      );

      const foundCast = await db.getAllAsync<FilmCastPerson>(
        `SELECT p.id,
                p.name,
                p.profile_path,
                p.popularity,
                p.known_for_department
         FROM nomination_movies nm
         INNER JOIN nominations n ON n.id = nm.nomination_id
         INNER JOIN categories c ON c.id = n.category_id
         INNER JOIN nomination_people np ON np.nomination_id = n.id
         INNER JOIN people p ON p.id = np.person_id
         WHERE nm.movie_id = ?
         GROUP BY p.id, p.name, p.profile_path, p.popularity, p.known_for_department
         ORDER BY COALESCE(p.popularity, 0) DESC,
                  p.name ASC
         LIMIT 10`,
        [id],
      );
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
        <></>
      ) : film ? (
        <FilmDetail
          film={film}
          directorPersonId={directorPersonId}
          castPeople={castPeople}
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
  text: {
    color: '#fff',
  },
});
