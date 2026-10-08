import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  LogOut,
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
  TrendingUp,
  KeyRound,
  Trash2,
  User as UserIcon,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/providers/auth';
import { Avatar, Badge, Button, PressableScale, ProgressRing, ScreenHeader } from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { radius, spacing, type ThemePreference, makeStyles, useTheme } from '../../src/theme';
import { humanize, calculateAge, formatDobDisplay, calculateBMI, getBMICategory } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';

const enter = (i: number) => FadeInDown.delay(60 + i * 70).duration(420);

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Smartphone },
];

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useStyles();
  const { user, logout } = useAuth();
  const router = useRouter();
  const bottomClearance = useTabBarClearance();

  const changeTheme = (value: ThemePreference) => {
    if (value === preference) return;
    haptics.selection();
    setPreference(value);
  };

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
  const age = calculateAge(profile?.date_of_birth);
  const dobFormatted = formatDobDisplay(profile?.date_of_birth);

  // Reuses the ['weights'] cache the Progress screen populates, so a weigh-in
  // logged there is reflected here immediately instead of the profile's own
  // weight_kg field, which only updates from the daily check-in / profile-edit
  // flows and otherwise goes stale as soon as a newer weigh-in is recorded.
  const { data: weights = [] } = useQuery({
    queryKey: ['weights'],
    queryFn: () => api.getWeights(),
  });
  const latestWeighIn = useMemo(() => {
    if (weights.length === 0) return null;
    return weights.reduce((latest, w) => (w.date > latest.date ? w : latest), weights[0]);
  }, [weights]);
  const displayWeightKg = latestWeighIn?.weight_kg ?? profile?.weight_kg ?? null;

  const bmi = calculateBMI(displayWeightKg, profile?.height_cm);
  const bmiCategory = bmi != null ? getBMICategory(bmi) : null;

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
              value={displayWeightKg ? `${displayWeightKg} kg` : '--'}
            />
            <ProfileStat
              icon={<Ruler size={16} color={colors.cyan} />}
              label="Height"
              value={profile?.height_cm ? `${profile.height_cm} cm` : '--'}
            />
            {bmi != null && bmiCategory ? (
              <ProfileStat
                icon={<Activity size={14} color={colors[bmiCategory.tone]} />}
                label={bmiCategory.label}
                value={`${bmi}`}
                valueColor={colors[bmiCategory.tone]}
                labelColor={colors[bmiCategory.tone]}
                gaugePercentage={Math.min(100, Math.max(10, Math.round(((bmi - 15) / 20) * 100)))}
                gaugeColor={colors[bmiCategory.tone]}
              />
            ) : (
              <ProfileStat
                icon={<CalendarDays size={16} color={colors.primaryLight} />}
                label="Age"
                value={age != null ? `${age}y` : '--'}
              />
            )}
          </View>
          <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
            <ProfileStat
              icon={<UserIcon size={16} color={colors.violet} />}
              label="Gender"
              value={profile?.sex ? humanize(profile.sex) : '--'}
            />
            <ProfileStat
              icon={<Activity size={16} color={colors.amber} />}
              label="Activity"
              value={humanize(profile?.activity_level) || 'Moderate'}
            />
            <ProfileStat
              icon={<CalendarDays size={16} color={colors.primaryLight} />}
              label="DOB"
              value={profile?.date_of_birth ? dobFormatted : '--'}
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
              subtitle="Name, DOB, Gender, weight, height, activity & goal"
              onPress={() => router.push('/profile-edit')}
              right={<ChevronRight size={18} color={colors.textMuted} />}
            />
            <SettingsRow
              icon={<TrendingUp size={18} color={colors.primaryLight} />}
              iconTint={colors.primarySurface}
              title="Progress & analytics"
              subtitle="Weight charts, PR records & measurements"
              onPress={() => router.push('/progress')}
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
              subtitle="Light, dark, or match your device"
            />
            <ThemeSegment preference={preference} onChangeTheme={changeTheme} />
          </View>
        </Animated.View>


        {/* Account */}
        <Animated.View entering={enter(3)}>
          <Text style={styles.groupLabel}>Account</Text>
          <View style={styles.group}>
            <SettingsRow
              first
              icon={<KeyRound size={18} color={colors.cyan} />}
              iconTint={colors.cyanGlow}
              title="Change password"
              onPress={() => router.push('/account/password')}
              right={<ChevronRight size={18} color={colors.textMuted} />}
            />
            <SettingsRow
              icon={<Trash2 size={18} color={colors.error} />}
              iconTint={colors.errorBackground}
              title="Delete account"
              subtitle="Permanently remove your account and data"
              onPress={() => router.push('/account/delete')}
              right={<ChevronRight size={18} color={colors.textMuted} />}
            />
          </View>
        </Animated.View>

        <Animated.View entering={enter(4)}>
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

function ProfileStat({
  icon,
  label,
  value,
  valueColor,
  labelColor,
  gaugePercentage,
  gaugeColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  labelColor?: string;
  gaugePercentage?: number;
  gaugeColor?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      {gaugePercentage !== undefined ? (
        <ProgressRing
          percentage={gaugePercentage}
          size={36}
          strokeWidth={3}
          color={gaugeColor ?? valueColor}
          delay={250}
        >
          {icon}
        </ProgressRing>
      ) : (
        icon
      )}
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
    </View>
  );
}

function ThemeSegment({
  preference,
  onChangeTheme,
}: {
  preference: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [containerWidth, setContainerWidth] = useState(0);

  const selectedIndex = THEME_OPTIONS.findIndex((opt) => opt.value === preference);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const itemWidth =
    containerWidth > 0 ? (containerWidth - (THEME_OPTIONS.length - 1) * spacing.sm) / THEME_OPTIONS.length : 0;
  const translateX = useSharedValue(0);

  React.useEffect(() => {
    if (itemWidth > 0) {
      const target = activeIndex * (itemWidth + spacing.sm);
      translateX.set(withSpring(target, { damping: 18, stiffness: 220 }));
    }
  }, [activeIndex, itemWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: itemWidth > 0 ? itemWidth : '33%',
  }));

  return (
    <View
      style={styles.segment}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width - spacing.md * 2)}
      accessibilityRole="radiogroup"
    >
      {itemWidth > 0 && (
        <Animated.View
          style={[styles.segmentIndicator, indicatorStyle]}
          pointerEvents="none"
        />
      )}
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const selected = value === preference;
        return (
          <PressableScale
            key={value}
            onPress={() => onChangeTheme(value)}
            style={styles.segmentItem}
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
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  iconTint: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  first?: boolean;
  onPress?: () => void;
}

function SettingsRow({ icon, iconTint, title, subtitle, right, first, onPress }: SettingsRowProps) {
  const styles = useStyles();
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: iconTint }]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
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

const useStyles = makeStyles(({ colors }) => ({
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
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    bottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
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
    zIndex: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextSelected: {
    color: colors.primaryLight,
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
}));
