import React from 'react';
import '../src/lib/alertPolyfill';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { addNetworkStateListener } from 'expo-network';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/providers/auth';
import { ToastProvider } from '../src/components/ui';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ThemeProvider, useTheme } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

// Pause queries while offline and refetch the moment the connection returns on native platforms.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    const subscription = addNetworkStateListener((state) => setOnline(state.isConnected !== false));
    return () => subscription.remove();
  });

  // Refetch stale queries whenever the app returns to the foreground on native platforms.
  AppState.addEventListener('change', (state) => {
    focusManager.setFocused(state === 'active');
  });
}

const modal = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

function RootNavigator() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="meal/add" options={modal} />
        <Stack.Screen name="meal/[id]" options={modal} />
        <Stack.Screen name="checkin" options={modal} />
        {/* A live workout must not be swiped away by accident; closing goes through the draft prompt. */}
        <Stack.Screen name="workout/log" options={{ ...modal, gestureEnabled: false }} />
        <Stack.Screen name="workout/complete" options={{ ...modal, gestureEnabled: false }} />
        <Stack.Screen name="workout/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-edit" options={modal} />
        <Stack.Screen name="account/password" options={modal} />
        <Stack.Screen name="account/delete" options={modal} />
        <Stack.Screen name="plan" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="onboarding" options={{ ...modal, gestureEnabled: false }} />
        <Stack.Screen name="plan-select" options={modal} />
      </Stack>
      <OfflineBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
