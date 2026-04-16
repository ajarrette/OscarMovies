import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

const APP_NAME = 'Oscar Movies';
const DEVELOPER_NAME = 'Aaron';
const STACK = [
  'Expo SDK 55 + Expo Router',
  'React 19 + React Native 0.83',
  'TypeScript',
  'SQLite local data layer',
  'TMDB images for rich artwork',
];

const version = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'About',
          headerShown: true,
          headerTransparent: false,
          headerStyle: { backgroundColor: '#25292e' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#25292e', '#3a3f47', '#4a5160']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.badgeRow}>
            <Ionicons name='sparkles-outline' size={16} color='#ffd33d' />
            <Text style={styles.badgeText}>Award season companion</Text>
          </View>
          <Text style={styles.heroTitle}>{APP_NAME}</Text>
          <Text style={styles.heroSubtitle}>
            Browse Oscar-nominated films and people, explore details quickly,
            and revisit nomination history in one focused mobile experience.
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What this app does</Text>
          <Text style={styles.cardBody}>
            Oscar Movies helps you discover films and people tied to Academy
            Award recognition. You can browse by year, open full detail pages,
            and review nomination context in a lightweight, offline-friendly
            flow.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Technology stack</Text>
          {STACK.map((item) => (
            <View key={item} style={styles.rowItem}>
              <Ionicons
                name='checkmark-circle-outline'
                size={18}
                color='#ffd33d'
              />
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Application information</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>App version</Text>
            <Text style={styles.metaValue}>v{version}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Developer</Text>
            <Text style={styles.metaValue}>{DEVELOPER_NAME}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Platform support</Text>
            <Text style={styles.metaValue}>iOS, Android, Web</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Runtime</Text>
            <Text style={styles.metaValue}>Expo ({Platform.OS})</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  content: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  hero: {
    borderRadius: 18,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#4a5160',
  },
  badgeRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1c2025',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#4a5160',
  },
  badgeText: {
    color: '#cdd1d8',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    color: '#c8cdd6',
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#3a3f47',
    borderWidth: 1,
    borderColor: '#4a5160',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  cardBody: {
    color: '#c8cdd6',
    fontSize: 14,
    lineHeight: 22,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4a5160',
    paddingBottom: 10,
  },
  metaLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  metaValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
