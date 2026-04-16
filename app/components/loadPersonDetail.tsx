import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import Person from '@/types/person';
import PersonDetail from './personDetail';

type Props = {
  id: number;
};

export default function LoadPersonDetail({ id }: Props) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<Person | null>(null);

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
                COALESCE((
                  SELECT COUNT(DISTINCT np.nomination_id)
                  FROM nomination_people np
                  WHERE np.person_id = p.id
                ), 0) AS nominations,
                COALESCE((
                  SELECT COUNT(DISTINCT np.nomination_id)
                  FROM nomination_people np
                  INNER JOIN nominations n ON n.id = np.nomination_id
                  WHERE np.person_id = p.id
                    AND n.won = 1
                ), 0) AS wins
         FROM people p
         WHERE p.id = ?`,
        [id],
      );

      setPerson(foundPerson);
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
        <PersonDetail person={person} />
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
