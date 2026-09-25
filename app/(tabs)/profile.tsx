import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { reloadAppAsync } from 'expo';
import {
  LogOut,
  Shield,
  Server,
  HardDrive,
  Building2,
  Ruler,
  Scale,
  Activity,
  PencilLine,
  ClipboardCheck,
  ChevronRight,
  CalendarDays,
  Palette,
  Sun,
  Moon,
  Smartphone,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { api } from '../../src/api/client';
import { checkDatabaseHealth } from '../../src/lib/db';
import { Avatar, Badge, Button, PressableScale, ScreenHeader } from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { colors, radius, spacing, themePreference, type ThemePreference } from '../../src/theme';
import { setThemePreference } from '../../src/theme/preference';
import { humanize } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';

const enter = (i: number) => FadeInDown.delay(60 + i * 70).duration(420);

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Smartphone },
];

// Every screen's styles are built from the palette at startup, so a theme change reloads the app.
function changeTheme(value: ThemePreference) {
  if (value === themePreference) return;
  haptics.selection();
  setThemePreference(value);
  reloadAppAsync('Theme changed').catch((err) => console.error('Failed to reload app:', err));
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const bottomClearance = useTabBarClearance();
  const [dbReady, setDbReady] = useState<boolean | null>(null);

  useEffect(() => {
    checkDatabaseHealth().then((ready) => setDbReady(ready));
  }, []);

  const handleLogout = () => {
    haptics.warning();
    Alert.alert('Log out?', 'You will need to sign in again to sync your training data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const profile = user?.profile;
  const memberships = user?.memberships || [];
  const name = user?.full_name || user?.username || 'User';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Account"
          title="Profile"
          right={
            <PressableScale
              haptic="selection"
              onPress={() => router.push('/profile-edit')}
              style={styles.editBtn}
              accessibilityLabel="Edit profile"
            >
              <PencilLine size={18} color={colors.primaryLight} />
            </PressableScale>
          }
        />

        {/* Identity */}
        <Animated.View entering={enter(0)} style={styles.heroCard}>
          <Svg style={styles.heroGlow} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <RadialGradient id="profileGlow" cx="50%" cy="0%" rx="75%" ry="60%">
                <Stop offset="0" stopColor={colors.primaryLight} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.primaryLight} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#profileGlow)" />
          </Svg>
          <Avatar name={name} imageUrl={user?.avatar_url} size={88} ring />
          <Text style={styles.userName}>{name}</Text>
          {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
          <Badge
            label={humanize(profile?.fitness_goal) || 'Athlete'}
            tone="emerald"
            style={styles.goalBadge}
          />

          <View style={styles.statsRow}>
            <ProfileStat
              icon={<Scale size={16} color={colors.primaryLight} />}
              label="Weight"
              value={profile?.weight_kg ? `${profile.weight_kg} kg` : '--'}
            />
            <ProfileStat
              icon={<Ruler size={16} color={colors.cyan} />}
              label="Height"
              value={profile?.height_cm ? `${profile.height_cm} cm` : '--'}
            />
            <ProfileStat
              icon={<Activity size={16} color={colors.amber} />}
              label="Activity"
              value={humanize(profile?.activity_level) || 'Moderate'}
            />
          </View>
        </Animated.View>

        {/* Logging */}
        <Animated.View entering={enter(1)}>
          <Text style={styles.groupLabel}>Your data</Text>
          <View style={styles.group}>
            <SettingsRow
              first
              icon={<PencilLine size={18} color={colors.primaryLight} />}
              iconTint={colors.primarySurface}
              title="Edit profile"
              subtitle="Name, weight, height, activity & goal"
              onPress={() => router.push('/profile-edit')}
              right={<ChevronRight size={18} color={colors.textMuted} />}
            />
            <SettingsRow
              icon={<ClipboardCheck size={18} color={colors.amber} />}
              iconTint={colors.amberGlow}
              title="Daily check-in"
              subtitle="Steps, sleep, energy & weigh-ins — any day"
              onPress={() => router.push('/checkin')}
              right={<ChevronRight size={18} color={colors.textMuted} />}
            />
            <SettingsRow
              icon={<CalendarDays size={18} color={colors.cyan} />}
              iconTint={colors.cyanGlow}
              title="Workout plan"
              subtitle="Your program schedule, or choose a new plan"
              onPress={() => router.push('/plan')}
              right={<ChevronRight size={18} color={colors.textMuted} />}
            />
          </View>
        </Animated.View>

        {/* Memberships */}
        {memberships.length > 0 && (
          <Animated.View entering={enter(1)}>
            <Text style={styles.groupLabel}>Gym memberships</Text>
            <View style={styles.group}>
              {memberships.map((m, i) => (
                <SettingsRow
                  key={m.id}
                  first={i === 0}
                  icon={<Building2 size={18} color={colors.primaryLight} />}
                  iconTint={colors.primarySurface}
                  title={m.gym_name || 'FitLog Gym'}
                  subtitle={humanize(m.role)}
                  right={
                    <Badge
                      label={m.status}
                      tone={m.status === 'ACTIVE' ? 'emerald' : m.status === 'SUSPENDED' ? 'rose' : 'slate'}
                    />
                  }
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Appearance */}
        <Animated.View entering={enter(2)}>
          <Text style={styles.groupLabel}>Appearance</Text>
          <View style={styles.group}>
            <SettingsRow
              first
              icon={<Palette size={18} color={colors.primaryLight} />}
              iconTint={colors.primarySurface}
              title="Theme"
              subtitle="Changing the theme restarts the app"
            />
            <View style={styles.segment} accessibilityRole="radiogroup">
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const selected = value === themePreference;
                return (
                  <PressableScale
                    key={value}
                    onPress={() => changeTheme(value)}
                    style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${label} theme`}
                  >
                    <Icon size={16} color={selected ? colors.primaryLight : colors.textSecondary} />
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* System */}
        <Animated.View entering={enter(2)}>
          <Text style={styles.groupLabel}>App & connection</Text>
          <View style={styles.group}>
            <SettingsRow
              first
              icon={<Server size={18} color={colors.cyan} />}
              iconTint={colors.cyanGlow}
              title="Backend API"
              subtitle={api.getBaseUrl()}
              mono
              right={<StatusDot color={colors.success} label="Connected" />}
            />
            <SettingsRow
              icon={<HardDrive size={18} color={colors.violet} />}
              iconTint="rgba(124, 58, 237, 0.15)"
              title="Offline database"
              subtitle={dbReady === null ? 'Checking…' : dbReady ? 'Healthy' : 'Unavailable'}
              right={
                <StatusDot
                  color={dbReady === null ? colors.warning : dbReady ? colors.success : colors.error}
                  label={dbReady ? 'Ready' : 'Pending'}
                />
              }
            />
            <SettingsRow
              icon={<Shield size={18} color={colors.primaryLight} />}
              iconTint={colors.primarySurface}
              title="Token security"
              subtitle="Encrypted device keychain"
              right={<StatusDot color={colors.success} label="Active" />}
            />
          </View>
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <Button
            title="Log Out"
            variant="secondary"
            size="lg"
            icon={<LogOut size={18} color={colors.error} />}
            iconPosition="left"
            onPress={handleLogout}
            textStyle={{ color: colors.error }}
            style={styles.logoutBtn}
          />
          <Text style={styles.versionText}>FitLog v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      {icon}
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.statusDotRow}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusDotText}>{label}</Text>
    </View>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  iconTint: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  first?: boolean;
  mono?: boolean;
  onPress?: () => void;
}

function SettingsRow({ icon, iconTint, title, subtitle, right, first, mono, onPress }: SettingsRowProps) {
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: iconTint }]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, mono && styles.mono]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );

  if (onPress) {
    return (
      <PressableScale
        haptic="selection"
        scaleTo={0.99}
        onPress={onPress}
        accessibilityLabel={title}
        style={[styles.row, !first && styles.rowBorder]}
      >
        {content}
      </PressableScale>
    );
  }

  return <View style={[styles.row, !first && styles.rowBorder]}>{content}</View>;
}

const styles = StyleSheet.create({
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.md,
    letterSpacing: -0.4,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  goalBadge: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 60,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  segmentItemSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextSelected: {
    color: colors.primaryLight,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  logoutBtn: {
    marginTop: spacing.xl,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBackground,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
