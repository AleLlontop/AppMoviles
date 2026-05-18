import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useThemeColors } from '@/hooks/use-theme-colors';

const TabIcon = ({ name, focused, size, inactiveColor }: any) => {
  if (focused) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
        <View style={{
          position: 'absolute', width: 22, height: 22,
          backgroundColor: '#A594F9', borderRadius: 11, opacity: 0.35,
          shadowColor: '#A594F9', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.8, shadowRadius: 8, elevation: 5,
        }} />
        <Ionicons name={name} size={size} color="#A594F9" />
      </View>
    );
  }
  return <Ionicons name={`${name}-outline` as any} size={size} color={inactiveColor} />;
};

export default function TabLayout() {
  const c = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarActiveTintColor: c.textPrimary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 32 : 24,
          left: 20,
          right: 20,
          backgroundColor: c.surface,
          borderRadius: 36,
          height: 72,
          paddingBottom: 12,
          paddingTop: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 20,
          elevation: 10,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} size={24} inactiveColor={c.textSecondary} />,
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: 'Group',
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} size={24} inactiveColor={c.textSecondary} />,
        }}
      />
      <Tabs.Screen
        name="estadisticas"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} size={24} inactiveColor={c.textSecondary} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon name="ellipsis-horizontal" focused={focused} size={24} inactiveColor={c.textSecondary} />,
        }}
      />
    </Tabs>
  );
}
