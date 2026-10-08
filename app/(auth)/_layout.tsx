import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
      initialRouteName="welcome"
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="signup" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
