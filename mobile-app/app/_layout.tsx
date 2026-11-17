import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { MealPlanProvider } from '../src/context/MealPlanContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MealPlanProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </MealPlanProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
