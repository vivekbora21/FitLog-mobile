import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Flame } from 'lucide-react-native';
import { Card, Badge, PressableScale } from '../ui';
import { radius, spacing, useTheme } from '../../theme';
import { useStyles } from './NutritionProgressSection.styles';
import { formatNumber } from '../../types';
import type { DashboardStats, CalorieBurnHistoryDay } from '../../types';

interface CalorieBurnSectionProps {
  dashboardStats?: DashboardStats | null;
  history?: CalorieBurnHistoryDay[];
  isLoading?: boolean;
}

type Granularity = 'DAY' | 'WEEK' | 'MONTH';

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'DAY', label: 'Days' },
  { key: 'WEEK', label: 'Weeks' },
  { key: 'MONTH', label: 'Months' },
];

interface Bucket {
  key: string;
  label: string;
  value: number;
  active: boolean;
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function buildDayBuckets(history: CalorieBurnHistoryDay[], count: number): Bucket[] {
  return [...history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-count)
    .map((d) => ({
      key: d.date,
      label: parseDateKey(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: d.calories_burned,
      active: d.has_workout,
    }));
}

function mondayOf(d: Date): Date {
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  return monday;
}

function buildWeekBuckets(history: CalorieBurnHistoryDay[], count: number): Bucket[] {
  const byWeek = new Map<string, { sum: number; active: boolean }>();
  for (const d of history) {
    const key = mondayOf(parseDateKey(d.date)).toISOString().slice(0, 10);
    const entry = byWeek.get(key) || { sum: 0, active: false };
    entry.sum += d.calories_burned;
    if (d.has_workout) entry.active = true;
    byWeek.set(key, entry);
  }
  return [...byWeek.keys()]
    .sort()
    .slice(-count)
    .map((key) => {
      const entry = byWeek.get(key)!;
      return {
        key,
        label: parseDateKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: entry.sum,
        active: entry.active,
      };
    });
}

function buildMonthBuckets(history: CalorieBurnHistoryDay[], count: number): Bucket[] {
  const byMonth = new Map<string, { sum: number; active: boolean }>();
  for (const d of history) {
    const key = d.date.slice(0, 7);
    const entry = byMonth.get(key) || { sum: 0, active: false };
    entry.sum += d.calories_burned;
    if (d.has_workout) entry.active = true;
    byMonth.set(key, entry);
  }
  return [...byMonth.keys()]
    .sort()
    .slice(-count)
    .map((key) => {
      const entry = byMonth.get(key)!;
      const [y, m] = key.split('-').map(Number);
      return {
        key,
        label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }),
        value: entry.sum,
        active: entry.active,
      };
    });
}

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(380);

export function CalorieBurnSection({ dashboardStats, history, isLoading }: CalorieBurnSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [granularity, setGranularity] = useState<Granularity>('DAY');

  const adherence = dashboardStats?.adherence?.calories_burned;
  const weekBurned = adherence?.actual ?? 0;
  const weekTarget = adherence?.target ?? 2000;
  const pct = weekTarget > 0 ? Math.round((weekBurned / weekTarget) * 100) : 0;
  const diff = weekBurned - weekTarget;

  const hasAnyWorkout = (history || []).some((d) => d.has_workout);

  const buckets = useMemo<Bucket[]>(() => {
    if (!history || !history.length) return [];
    if (granularity === 'DAY') return buildDayBuckets(history, 14);
    if (granularity === 'WEEK') return buildWeekBuckets(history, 8);
    return buildMonthBuckets(history, 6);
  }, [history, granularity]);

  const maxVal = Math.max(1, ...buckets.map((b) => b.value));
  const totalBurned = buckets.reduce((sum, b) => sum + b.value, 0);
  const activeCount = buckets.filter((b) => b.active).length;

  if (isLoading && !history) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading workout calorie data...</Text>
      </View>
    );
  }

  if (!hasAnyWorkout) {
    return (
      <Card style={styles.emptyCard}>
        <Flame size={32} color={colors.rose} />
        <Text style={styles.emptyTitle}>No workouts logged yet</Text>
        <Text style={styles.emptySub}>
          Log a workout or cardio session in the Workout tab to start tracking calories burned.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={enter(0)} style={styles.metricsRow}>
        <Card style={[styles.metricCard, { flex: 1 }]}>
          <Flame size={14} color={colors.rose} />
          <Text style={styles.metricLabel}>This Week</Text>
          <Text style={[styles.metricValue, { color: colors.rose }]}>
            {formatNumber(weekBurned)}
            <Text style={styles.metricUnit}> kcal</Text>
          </Text>
          <Text style={styles.metricTarget}>Goal: {formatNumber(weekTarget)} kcal</Text>
          <View style={styles.metricAdherenceRow}>
            <View
              style={[
                styles.metricStatusDot,
                { backgroundColor: diff >= 0 ? colors.success : colors.amber },
              ]}
            />
            <Text style={styles.metricAdherenceText}>
              {diff >= 0
                ? `${formatNumber(diff)} kcal over goal`
                : `${formatNumber(-diff)} kcal to go`}
            </Text>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card elevated style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartHeaderLeft}>
              <View style={styles.chartIconBadge}>
                <Flame size={13} color={colors.rose} />
              </View>
              <View>
                <Text style={styles.chartTitle}>History</Text>
                <Text style={styles.chartSub}>
                  {formatNumber(totalBurned)} kcal · {activeCount} active {granularity === 'DAY' ? 'days' : granularity === 'WEEK' ? 'weeks' : 'months'}
                </Text>
              </View>
            </View>
            <Badge label={`${pct}% of weekly goal`} tone={pct >= 100 ? 'emerald' : pct >= 50 ? 'amber' : 'slate'} />
          </View>

          <View style={styles.timeframeRow}>
            {GRANULARITIES.map((g) => {
              const active = granularity === g.key;
              return (
                <PressableScale
                  key={g.key}
                  haptic="selection"
                  onPress={() => setGranularity(g.key)}
                  style={[styles.timeframeBtn, active && styles.timeframeBtnActive]}
                  accessibilityLabel={`Show by ${g.label}`}
                >
                  <Text style={[styles.timeframeBtnText, active && styles.timeframeBtnTextActive]}>
                    {g.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {buckets.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: spacing.md }}>
              {buckets.map((b) => {
                const barHeight = b.value > 0 ? Math.max(6, (b.value / maxVal) * 120) : 4;
                return (
                  <View key={b.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted }} numberOfLines={1}>
                      {b.value > 0 ? Math.round(b.value) : ''}
                    </Text>
                    <View style={{ width: '100%', height: 120, justifyContent: 'flex-end' }}>
                      <View
                        style={{
                          width: '100%',
                          height: barHeight,
                          borderRadius: radius.sm,
                          backgroundColor: b.value > 0 ? colors.rose : colors.borderSubtle,
                        }}
                      />
                    </View>
                    <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600' }} numberOfLines={1}>
                      {b.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyChartBox}>
              <Flame size={24} color={colors.textMuted} />
              <Text style={styles.emptyChartText}>No calorie data logged yet for this period.</Text>
            </View>
          )}
        </Card>
      </Animated.View>
    </View>
  );
}
