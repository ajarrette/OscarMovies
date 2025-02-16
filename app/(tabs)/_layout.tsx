import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

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
