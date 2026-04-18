import LoadPersonDetail from '../components/loadPersonDetail';
import { useLocalSearchParams } from 'expo-router';

export default function Person() {
  const { id } = useLocalSearchParams();

  return <LoadPersonDetail id={+id} />;
}
