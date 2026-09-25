import React, { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { LayoutDashboard, Dumbbell, Utensils, TrendingUp, User } from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { TabBar } from '../../src/components/navigation/TabBar';
import { useTheme } from '../../src/theme';
import { getFlag } from '../../src/lib/secureStore';
import { needsOnboarding, onboardingSkipKey } from '../../src/lib/onboarding';

export default function TabLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const promptedFor = useRef<string | number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // First run: ask for measurements and goals until they're filled in (or the user skips).
  useEffect(() => {
    if (!user || promptedFor.current === user.id || !needsOnboarding(user.profile)) return;
    promptedFor.current = user.id;
    getFlag(onboardingSkipKey(user.id)).then((skipped) => {
      if (!skipped) router.push('/onboarding');
    });
  }, [user, router]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <LayoutDashboard size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size, focused }) => (
            <Dumbbell size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color, size, focused }) => (
            <Utensils size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size, focused }) => (
            <TrendingUp size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <User size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
