import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import Film from '@/types/film';
import FilmDetail from './filmDetail';

type Props = {
  id: number;
};

export default function LoadFilmDetail({ id }: Props) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [film, setFilm] = useState<Film | null>(null);

  useEffect(() => {
    const loadFilm = async () => {
      const foundFilm = await db.getFirstAsync<Film | null>(
        'SELECT * FROM movies WHERE id = ?',
        [id],
      );
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
        <FilmDetail film={film} />
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
