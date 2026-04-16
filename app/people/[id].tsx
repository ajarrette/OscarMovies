import LoadPersonDetail from '../components/loadPersonDetail';
import { useLocalSearchParams } from 'expo-router';
import FilmsDbProvider from '../components/filmsDbProvider';

export default function Person() {
  const { id } = useLocalSearchParams();

  return (
    <FilmsDbProvider>
      <LoadPersonDetail id={+id} />
    </FilmsDbProvider>
  );
}
