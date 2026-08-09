/**
 * Root layout: providers, audio warm-up, and the shared navigation stack.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initAudio } from '../src/feedback/sounds';
import { UI } from '../src/theme/colors';

export default function RootLayout() {
  useEffect(() => {
    // Preload every effect once so the first tap is not the one that pays the
    // decoding cost.
    void initAudio();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: UI.backdrop[0] },
            animation: 'fade',
            animationDuration: 180,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="game" />
          <Stack.Screen name="levels" />
          <Stack.Screen name="settings" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
