import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerStyle: { backgroundColor: '#25292e' },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#25292e',
        },
      }}
    >
      <Tabs.Screen
        name='movies'
        options={{
          title: 'Movies',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home-sharp' : 'home-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name='test'
        options={{
          title: 'Test',
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search-circle' : 'search-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name='search'
        options={{
          headerTitle: 'Search',
          headerTransparent: true,
          headerBackground: () => (
            <BlurView
              tint='dark'
              intensity={100}
              style={StyleSheet.absoluteFill}
            />
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search-circle' : 'search-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name='about'
        options={{
          title: 'About',
          headerTitle: '',
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused ? 'information-circle' : 'information-circle-outline'
              }
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
