import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Flame, Trophy, Dumbbell, Utensils, Award } from 'lucide-react-native';
import { Card, ProgressBar, EmptyState, useToast } from '../ui';
import { useTheme } from '../../theme';
import { useStyles } from './AchievementsSection.styles';
import { computeLoggingStreak } from '../../lib/format';
import { diffNewlyEarnedTiers } from '../../lib/achievements';
import { haptics } from '../../lib/haptics';
import type { DashboardStats, PersonalRecord, NutritionHistoryResponse } from '../../types';

interface Tier {
  threshold: number;
  name: string;
}

interface Track {
  id: string;
  title: string;
  sub: string;
  value: number;
  unit: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
  tiers: Tier[];
}

function currentTierIndex(value: number, tiers: Tier[]): number {
  let idx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (value >= tiers[i].threshold) idx = i;
  }
  return idx;
}

function AchievementTrack({ track }: { track: Track }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const earnedIdx = currentTierIndex(track.value, track.tiers);
  const nextTier = track.tiers[earnedIdx + 1];
  const prevThreshold = earnedIdx >= 0 ? track.tiers[earnedIdx].threshold : 0;
  const progressPct = nextTier
    ? Math.min(
        100,
        Math.round(((track.value - prevThreshold) / (nextTier.threshold - prevThreshold)) * 100)
      )
    : 100;
  const Icon = track.icon;

  return (
    <Card style={styles.trackCard}>
      <View style={styles.trackHeader}>
        <View style={[styles.trackIconBadge, { backgroundColor: `${track.color}22` }]}>
          <Icon size={18} color={track.color} strokeWidth={2.2} />
        </View>
        <View style={styles.trackHeaderText}>
          <Text style={styles.trackTitle}>{track.title}</Text>
          <Text style={styles.trackSub}>{track.sub}</Text>
        </View>
        <Text style={[styles.trackValue, { color: track.color }]}>
          {track.value}
          <Text style={styles.trackSub}> {track.unit}</Text>
        </Text>
      </View>

      <View style={styles.tiersRow}>
        {track.tiers.map((tier, i) => {
          const earned = i <= earnedIdx;
          return (
            <View
              key={tier.name}
              style={[styles.tierChip, earned && styles.tierChipEarned, earned && { backgroundColor: `${track.color}14` }]}
            >
              <View
                style={[
                  styles.tierIconWrap,
                  { backgroundColor: earned ? track.color : colors.borderSubtle },
                ]}
              >
                <Award size={14} color={earned ? colors.textInverse : colors.textMuted} strokeWidth={2.2} />
              </View>
              <Text style={[styles.tierLabel, earned && styles.tierLabelEarned]} numberOfLines={1}>
                {tier.name}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.progressRow}>
        {nextTier ? (
          <>
            <ProgressBar percentage={progressPct} color={track.color} />
            <Text style={styles.progressText}>
              {Math.max(0, nextTier.threshold - track.value)} {track.unit} to {nextTier.name}
            </Text>
          </>
        ) : (
          <Text style={[styles.progressText, styles.progressTextDone]}>
            All milestones unlocked — {track.tiers[track.tiers.length - 1]?.name}
          </Text>
        )}
      </View>
    </Card>
  );
}

interface AchievementsSectionProps {
  dashboardStats?: DashboardStats;
  prs: PersonalRecord[];
  nutritionHistory?: NutritionHistoryResponse;
  isLoading?: boolean;
}

export function AchievementsSection({
  dashboardStats,
  prs,
  nutritionHistory,
  isLoading,
}: AchievementsSectionProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const showToast = useToast();

  const sessionsLast90Days = useMemo(() => {
    const heatmap = dashboardStats?.activity_heatmap ?? {};
    return Object.values(heatmap).reduce((sum, n) => sum + (n > 0 ? 1 : 0), 0);
  }, [dashboardStats]);

  const nutritionStreak = useMemo(() => {
    if (!nutritionHistory?.history?.length) return 0;
    const byDate = new Map(nutritionHistory.history.map((d) => [d.date, d]));
    return computeLoggingStreak((dateKey) => !!byDate.get(dateKey)?.has_logged);
  }, [nutritionHistory]);

  const tracks: Track[] = [
    {
      id: 'streak',
      title: 'Workout Streak',
      sub: 'Current active-day streak',
      value: dashboardStats?.streak_days ?? 0,
      unit: 'days',
      icon: Flame,
      color: colors.amber,
      tiers: [
        { threshold: 3, name: 'Spark' },
        { threshold: 7, name: 'Lit' },
        { threshold: 30, name: 'Blazing' },
        { threshold: 100, name: 'Inferno' },
      ],
    },
    {
      id: 'prs',
      title: 'Personal Records',
      sub: 'Lifts you\'ve beaten your own best on',
      value: prs.length,
      unit: 'PRs',
      icon: Trophy,
      color: colors.primaryLight,
      tiers: [
        { threshold: 1, name: 'First PR' },
        { threshold: 5, name: 'Climbing' },
        { threshold: 10, name: 'Record Holder' },
        { threshold: 25, name: 'Elite' },
      ],
    },
    {
      id: 'sessions90',
      title: 'Active Days',
      sub: 'Days trained in the last 90 days',
      value: sessionsLast90Days,
      unit: 'days',
      icon: Dumbbell,
      color: colors.violet,
      tiers: [
        { threshold: 5, name: 'Starter' },
        { threshold: 15, name: 'Regular' },
        { threshold: 30, name: 'Committed' },
        { threshold: 60, name: 'Relentless' },
      ],
    },
    {
      id: 'nutrition',
      title: 'Nutrition Logging',
      sub: 'Consecutive days of logged meals',
      value: nutritionStreak,
      unit: 'days',
      icon: Utensils,
      color: colors.cyan,
      tiers: [
        { threshold: 3, name: 'Tracking' },
        { threshold: 7, name: 'Dialed In' },
        { threshold: 30, name: 'Disciplined' },
        { threshold: 60, name: 'Master' },
      ],
    },
  ];

  const valuesSignature = tracks.map((t) => t.value).join(',');
  const earnedKeys = useMemo(
    () =>
      tracks.flatMap((track) => {
        const earnedIdx = currentTierIndex(track.value, track.tiers);
        return track.tiers.slice(0, earnedIdx + 1).map((tier) => `${track.id}:${tier.name}`);
      }),
    // `tracks` is rebuilt every render; valuesSignature is the real identity to key on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valuesSignature]
  );
  const earnedKeysSignature = earnedKeys.join(',');

  useEffect(() => {
    if (isLoading || earnedKeys.length === 0) return;
    const newly = diffNewlyEarnedTiers(earnedKeys);
    if (newly.length === 0) return;
    const [trackId, tierName] = newly[0].split(':');
    const track = tracks.find((t) => t.id === trackId);
    haptics.success();
    showToast({ message: `🏆 New milestone: ${tierName}${track ? ` — ${track.title}` : ''}` });
    // Only re-run when the set of earned tiers actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedKeysSignature, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading achievements…</Text>
      </View>
    );
  }

  const hasAnyProgress = tracks.some((t) => t.value > 0);

  if (!hasAnyProgress) {
    return (
      <EmptyState
        title="No achievements yet"
        description="Log a workout, hit a personal record, or track a meal to start earning milestones."
        icon={<Trophy size={32} color={colors.textMuted} />}
      />
    );
  }

  return (
    <View style={styles.container}>
      {tracks.map((track, i) => (
        <Animated.View key={track.id} entering={FadeInDown.delay(50 + i * 60).duration(360)}>
          <AchievementTrack track={track} />
        </Animated.View>
      ))}
    </View>
  );
}
