import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/use-theme-colors';

export default function GroupScreen() {
  const c = useThemeColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 18, color: c.textSecondary }}>Group Screen</Text>
    </SafeAreaView>
  );
}
