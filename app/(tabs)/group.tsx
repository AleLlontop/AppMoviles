import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9fe', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 18, color: '#374151' }}>Group Screen</Text>
    </SafeAreaView>
  );
}
