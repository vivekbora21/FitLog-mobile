import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/providers/auth';
import { colors } from '../src/theme';
import { getFlag } from '../src/lib/secureStore';
import { needsOnboarding, onboardingSkipKey } from '../src/lib/onboarding';

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (user && needsOnboarding(user.profile)) {
          getFlag(onboardingSkipKey(user.id)).then((skipped) => {
            if (!skipped) {
              router.replace('/onboarding');
            } else {
              router.replace('/(tabs)');
            }
          });
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primaryLight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
