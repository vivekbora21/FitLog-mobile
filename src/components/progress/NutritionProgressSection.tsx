import React, { useMemo, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import {
  Utensils,
  Flame,
  Dumbbell,
  Calendar,
  ArrowRight,
  Scale,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Wheat,
  Droplet,
  Zap,
} from 'lucide-react-native';
import { Card, Badge, Button, PressableScale } from '../ui';
import { radius, spacing, useTheme } from '../../theme';
import { useStyles } from './NutritionProgressSection.styles';
import { formatNumber } from '../../types';
import type { NutritionHistoryResponse, NutritionHistoryDay, WeightEntry, WeeklyNutritionSummary } from '../../types';
import { computeWeeklyNutritionSummaries, calculateMacroRatio } from '../../lib/nutritionWeeks';
import { haptics } from '../../lib/haptics';
import { toDateKey } from '../../lib/format';

// ─── Timeframe Filter ─────────────────────────────────────────────────────────

type Timeframe = '7D' | '4W' | '3M' | '6M' | '1Y';

const TIMEFRAMES: { key: Timeframe; label: string; days: number }[] = [
  { key: '7D', label: '7D', days: 7 },
  { key: '4W', label: '4W', days: 28 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
];

// ─── Nutrient Metric Selector ─────────────────────────────────────────────────

type Metric = 'calories' | 'protein' | 'carbs' | 'fat';

type MetricConfig = {
  key: Metric;
  label: string;
  valueKey: 'total_calories' | 'total_protein' | 'total_carbs' | 'total_fat';
  unit: string;
  icon: typeof Flame;
  colorKey: 'primaryLight' | 'cyan' | 'amber' | 'violet';
  formatLabel: (v: number) => string;
};

const METRICS: MetricConfig[] = [
  { key: 'calories', label: 'Calories', valueKey: 'total_calories', unit: 'kcal', icon: Flame, colorKey: 'primaryLight', formatLabel: (v) => formatNumber(Math.round(v)) },
  { key: 'protein', label: 'Protein', valueKey: 'total_protein', unit: 'g', icon: Dumbbell, colorKey: 'cyan', formatLabel: (v) => `${Math.round(v)}` },
  { key: 'carbs', label: 'Carbs', valueKey: 'total_carbs', unit: 'g', icon: Wheat, colorKey: 'amber', formatLabel: (v) => `${Math.round(v)}` },
  { key: 'fat', label: 'Fat', valueKey: 'total_fat', unit: 'g', icon: Droplet, colorKey: 'violet', formatLabel: (v) => `${Math.round(v)}` },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface NutritionProgressSectionProps {
  nutritionHistory?: NutritionHistoryResponse | null;
  weights?: WeightEntry[];
  isLoading?: boolean;
  onNavigateToNutrition: () => void;
}

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(380);

// ─── Main Section ─────────────────────────────────────────────────────────────

export function NutritionProgressSection({
  nutritionHistory,
  weights = [],
  isLoading,
  onNavigateToNutrition,
}: NutritionProgressSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  const [metric, setMetric] = useState<Metric>('calories');
  const [timeframe, setTimeframe] = useState<Timeframe>('4W');

  // Compute weeks from history — only past/current weeks, latest 5
  const weeks: WeeklyNutritionSummary[] = useMemo(() => {
    if (!nutritionHistory?.history) return [];
    const allWeeks = computeWeeklyNutritionSummaries(
      nutritionHistory.history,
      nutritionHistory.targets,
      nutritionHistory.plan?.mode
    );
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    // Keep only weeks whose start date is not in the future, take the 5 most recent
    return allWeeks
      .filter((w) => new Date(w.week_start) <= today)
      .slice(0, 5);
  }, [nutritionHistory]);

  const currentWeek = weeks[0];
  const targetCalories = currentWeek?.target_calories || nutritionHistory?.targets?.daily_calories || 2200;
  const targetProtein = currentWeek?.target_protein || nutritionHistory?.targets?.protein_g || 160;

  // All daily history sorted oldest → newest, only logged days
  const sortedHistory: NutritionHistoryDay[] = useMemo(() => {
    if (!nutritionHistory?.history) return [];
    return [...nutritionHistory.history]
      .filter((d) => d.has_logged)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [nutritionHistory]);

  // Filter daily history by timeframe
  const getFilteredDays = useCallback(
    (timeframe: Timeframe): NutritionHistoryDay[] => {
      const tf = TIMEFRAMES.find((t) => t.key === timeframe)!;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - tf.days);
      return sortedHistory.filter((d) => new Date(d.date) >= cutoff);
    },
    [sortedHistory]
  );

  const chartDays = useMemo(() => getFilteredDays(timeframe), [timeframe, getFilteredDays]);

  // Consecutive-day logging streak, counted backward from the most recent day
  // the user had a chance to log (today, or the latest day present in history).
  const loggingStreak = useMemo(() => {
    if (!nutritionHistory?.history?.length) return 0;
    const byDate = new Map(nutritionHistory.history.map((d) => [d.date, d]));
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // If today has no entry yet (not logged, day in progress), start counting from yesterday.
    if (!byDate.get(toDateKey(cursor))?.has_logged) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    while (true) {
      const day = byDate.get(toDateKey(cursor));
      if (!day?.has_logged) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [nutritionHistory]);

  const metricConfig = METRICS.find((m) => m.key === metric)!;
  const metricTarget = useMemo(() => {
    switch (metric) {
      case 'calories':
        return targetCalories;
      case 'protein':
        return targetProtein;
      case 'carbs':
        return currentWeek?.target_carbs || nutritionHistory?.targets?.carbs_g || 200;
      case 'fat':
        return currentWeek?.target_fat || nutritionHistory?.targets?.fat_g || 70;
    }
  }, [metric, targetCalories, targetProtein, currentWeek, nutritionHistory]);

  // Weight map per week for correlation
  const weightByWeek = useMemo(() => {
    const map = new Map<string, { avgWeight: number; count: number; diff?: number }>();
    if (!weights.length) return map;
    weeks.forEach((w) => {
      const start = new Date(w.week_start).getTime();
      const end = new Date(w.week_end).getTime() + 86400000;
      const weekWeights = weights
        .filter((wt) => {
          const t = new Date(wt.date).getTime();
          return t >= start && t <= end;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (weekWeights.length > 0) {
        const avg = weekWeights.reduce((sum, wt) => sum + wt.weight_kg, 0) / weekWeights.length;
        const diff =
          weekWeights.length > 1
            ? weekWeights[weekWeights.length - 1].weight_kg - weekWeights[0].weight_kg
            : undefined;
        map.set(w.week_start, {
          avgWeight: Math.round(avg * 10) / 10,
          count: weekWeights.length,
          diff: diff != null ? Math.round(diff * 10) / 10 : undefined,
        });
      }
    });
    return map;
  }, [weeks, weights]);

  // Macro distribution for current week
  const currentRatio = useMemo(() => {
    if (!currentWeek) return { proteinPct: 30, carbsPct: 45, fatPct: 25 };
    return calculateMacroRatio(currentWeek.avg_protein, currentWeek.avg_carbs, currentWeek.avg_fat);
  }, [currentWeek]);

  if (isLoading && !nutritionHistory) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading nutrition analytics...</Text>
      </View>
    );
  }

  if (!sortedHistory.length && !weeks.length) {
    return (
      <Card style={styles.emptyCard}>
        <Utensils size={32} color={colors.primaryLight} />
        <Text style={styles.emptyTitle}>No nutrition history yet</Text>
        <Text style={styles.emptySub}>
          Log your meals in the Nutrition tab to start tracking daily calorie and protein trends.
        </Text>
        <Button
          title="Go to Nutrition"
          variant="primary"
          onPress={onNavigateToNutrition}
          style={{ marginTop: spacing.md }}
        />
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── KPI Summary Row ── */}
      <Animated.View entering={enter(0)} style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Flame size={14} color={colors.primaryLight} />
          <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            This Week Avg
          </Text>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {currentWeek?.avg_calories ? formatNumber(currentWeek.avg_calories) : '--'}
            <Text style={styles.metricUnit}> kcal</Text>
          </Text>
          <Text style={styles.metricTarget} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Target: {formatNumber(targetCalories)} kcal
          </Text>
          <View style={styles.metricAdherenceRow}>
            <View
              style={[
                styles.metricStatusDot,
                {
                  backgroundColor: !currentWeek?.logged_count
                    ? colors.textMuted
                    : currentWeek.avg_calories <= targetCalories
                    ? colors.primaryLight
                    : colors.warning,
                },
              ]}
            />
            <Text style={styles.metricAdherenceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {currentWeek?.logged_count
                ? currentWeek.avg_calories <= targetCalories
                  ? `${targetCalories - currentWeek.avg_calories} kcal under`
                  : `${currentWeek.avg_calories - targetCalories} kcal over`
                : 'No logs yet'}
            </Text>
          </View>
        </Card>

        <Card style={styles.metricCard}>
          <Dumbbell size={14} color={colors.cyan} />
          <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Protein Avg
          </Text>
          <Text style={[styles.metricValue, { color: colors.cyan }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {currentWeek?.avg_protein ? Math.round(currentWeek.avg_protein) : '--'}
            <Text style={styles.metricUnit}> g</Text>
          </Text>
          <Text style={styles.metricTarget} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Target: {formatNumber(targetProtein)} g
          </Text>
          <View style={styles.metricAdherenceRow}>
            <View
              style={[
                styles.metricStatusDot,
                {
                  backgroundColor: !currentWeek?.logged_count
                    ? colors.textMuted
                    : currentWeek.avg_protein >= targetProtein
                    ? colors.success
                    : colors.cyan,
                },
              ]}
            />
            <Text style={styles.metricAdherenceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {currentWeek?.logged_count ? `${currentWeek.protein_adherence_pct}% target met` : 'No logs yet'}
            </Text>
          </View>
        </Card>

        <Card style={styles.metricCard}>
          <Zap size={14} color={colors.amber} />
          <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Logging Streak
          </Text>
          <Text style={[styles.metricValue, { color: colors.amber }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {loggingStreak}
            <Text style={styles.metricUnit}> {loggingStreak === 1 ? 'day' : 'days'}</Text>
          </Text>
          <Text style={styles.metricTarget} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {loggingStreak > 0 ? 'Keep it going' : 'Log today to start'}
          </Text>
          <View style={styles.metricAdherenceRow}>
            <View
              style={[
                styles.metricStatusDot,
                { backgroundColor: loggingStreak > 0 ? colors.amber : colors.textMuted },
              ]}
            />
            <Text style={styles.metricAdherenceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {loggingStreak >= 7 ? 'On fire 🔥' : loggingStreak > 0 ? 'Consecutive days' : 'No active streak'}
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Daily Nutrient Chart ── */}
      <Animated.View entering={enter(1)}>
        <Card elevated style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartHeaderLeft}>
              <View style={[styles.chartIconBadge, { backgroundColor: `${colors[metricConfig.colorKey]}22` }]}>
                <metricConfig.icon size={13} color={colors[metricConfig.colorKey]} />
              </View>
              <View>
                <Text style={styles.chartTitle}>Daily {metricConfig.label}</Text>
                <Text style={styles.chartSub}>{chartDays.length} days logged</Text>
              </View>
            </View>
            <Badge
              label={`Target: ${metricConfig.formatLabel(metricTarget)}${metric === 'calories' ? '' : 'g'}`}
              tone={metric === 'calories' ? 'violet' : metric === 'protein' ? 'cyan' : metric === 'carbs' ? 'amber' : 'violet'}
            />
          </View>

          {/* Metric selector */}
          <View style={styles.metricSelectorRow}>
            {METRICS.map((m) => {
              const active = m.key === metric;
              return (
                <PressableScale
                  key={m.key}
                  haptic="selection"
                  onPress={() => setMetric(m.key)}
                  style={[
                    styles.metricSelectorBtn,
                    active && { backgroundColor: `${colors[m.colorKey]}1E`, borderColor: colors[m.colorKey] },
                  ]}
                  accessibilityLabel={`Show daily ${m.label}`}
                >
                  <m.icon size={12} color={active ? colors[m.colorKey] : colors.textMuted} strokeWidth={active ? 2.4 : 1.8} />
                  <Text style={[styles.metricSelectorText, active && { color: colors[m.colorKey] }]}>
                    {m.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <TimeframeFilter selected={timeframe} onChange={setTimeframe} />

          {chartDays.length >= 1 ? (
            <DailyNutrientChart
              days={chartDays}
              valueKey={metricConfig.valueKey}
              targetValue={metricTarget}
              color={colors[metricConfig.colorKey]}
              gradientId={`${metric}Grad`}
              unit={metricConfig.unit}
              formatLabel={metricConfig.formatLabel}
              timeframe={timeframe}
            />
          ) : (
            <View style={styles.emptyChartBox}>
              <metricConfig.icon size={24} color={colors.textMuted} />
              <Text style={styles.emptyChartText}>
                No {metricConfig.label.toLowerCase()} data logged yet for this period.
              </Text>
            </View>
          )}

          {/* Macro caloric split */}
          <View style={styles.macroSplitContainer}>
            <Text style={styles.macroSplitTitle}>Current Caloric Distribution</Text>
            <View style={styles.macroSplitBar}>
              <View style={[styles.macroSplitSeg, { flex: currentRatio.proteinPct, backgroundColor: colors.cyan }]} />
              <View style={[styles.macroSplitSeg, { flex: currentRatio.carbsPct, backgroundColor: colors.amber }]} />
              <View style={[styles.macroSplitSeg, { flex: currentRatio.fatPct, backgroundColor: colors.violet }]} />
            </View>
            <View style={styles.macroSplitLegend}>
              <Text style={styles.macroSplitText}>
                <Text style={{ color: colors.cyan, fontWeight: '800' }}>● </Text>Protein {currentRatio.proteinPct}%
              </Text>
              <Text style={styles.macroSplitText}>
                <Text style={{ color: colors.amber, fontWeight: '800' }}>● </Text>Carbs {currentRatio.carbsPct}%
              </Text>
              <Text style={styles.macroSplitText}>
                <Text style={{ color: colors.violet, fontWeight: '800' }}>● </Text>Fat {currentRatio.fatPct}%
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Week-by-Week Breakdown ── */}
      {weeks.length > 0 && (
        <Animated.View entering={enter(3)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Week-by-Week Breakdown</Text>
            <Text style={styles.sectionSub}>{weeks.length} weeks tracked</Text>
          </View>

          {weeks.map((weekItem, index) => {
            const isCurrent = index === 0;
            const weightInfo = weightByWeek.get(weekItem.week_start);
            const diff = weekItem.avg_calories - weekItem.target_calories;
            const isMet = weekItem.avg_calories > 0 && diff <= 0;

            return (
              <Animated.View key={weekItem.week_start} entering={enter(4 + Math.min(index, 5))}>
                <Card elevated={isCurrent} style={[styles.weekCard, isCurrent && styles.currentWeekCard]}>
                  <View style={styles.weekCardHeader}>
                    <View>
                      <View style={styles.weekTitleRow}>
                        <Calendar size={14} color={isCurrent ? colors.primaryLight : colors.textMuted} />
                        <Text style={[styles.weekTitle, isCurrent && { color: colors.primaryLight }]}>
                          {weekItem.label}
                        </Text>
                        {isCurrent && <Badge label="Active Week" tone="cyan" />}
                      </View>
                      <Text style={styles.weekDates}>
                        {weekItem.week_start} – {weekItem.week_end}
                      </Text>
                    </View>
                    <Badge
                      label={`${weekItem.logged_count}/7 Days`}
                      tone={weekItem.logged_count >= 5 ? 'emerald' : weekItem.logged_count > 0 ? 'amber' : 'slate'}
                    />
                  </View>

                  {weekItem.logged_count > 0 ? (
                    <>
                      <View style={styles.weekNutrientsRow}>
                        <View style={styles.nutrientPill}>
                          <Flame size={12} color={colors.primaryLight} />
                          <Text style={styles.nutrientPillLabel}>Calories</Text>
                          <Text style={styles.nutrientPillVal}>
                            {formatNumber(weekItem.avg_calories)}
                            <Text style={styles.nutrientPillUnit}> kcal/d</Text>
                          </Text>
                          <Text
                            style={[
                              styles.nutrientPillDelta,
                              { color: isMet ? colors.success : colors.warning },
                            ]}
                          >
                            {diff === 0 ? 'On Target' : diff > 0 ? `+${diff}` : `${diff}`}
                          </Text>
                        </View>

                        <View style={styles.nutrientPill}>
                          <View style={[styles.dotSmall, { backgroundColor: colors.cyan }]} />
                          <Text style={styles.nutrientPillLabel}>Protein</Text>
                          <Text style={styles.nutrientPillVal}>
                            {Math.round(weekItem.avg_protein)}
                            <Text style={styles.nutrientPillUnit}>g/d</Text>
                          </Text>
                          <Text style={styles.nutrientPillTarget}>
                            /{weekItem.target_protein}g ({weekItem.protein_adherence_pct}%)
                          </Text>
                        </View>

                        <View style={styles.nutrientPill}>
                          <View style={[styles.dotSmall, { backgroundColor: colors.amber }]} />
                          <Text style={styles.nutrientPillLabel}>Carbs</Text>
                          <Text style={styles.nutrientPillVal}>
                            {Math.round(weekItem.avg_carbs)}
                            <Text style={styles.nutrientPillUnit}>g/d</Text>
                          </Text>
                          <Text style={styles.nutrientPillTarget}>/{weekItem.target_carbs}g</Text>
                        </View>

                        <View style={styles.nutrientPill}>
                          <View style={[styles.dotSmall, { backgroundColor: colors.violet }]} />
                          <Text style={styles.nutrientPillLabel}>Fat</Text>
                          <Text style={styles.nutrientPillVal}>
                            {Math.round(weekItem.avg_fat)}
                            <Text style={styles.nutrientPillUnit}>g/d</Text>
                          </Text>
                          <Text style={styles.nutrientPillTarget}>/{weekItem.target_fat}g</Text>
                        </View>
                      </View>

                      {weightInfo && (
                        <View style={styles.weightCorrelationRow}>
                          <Scale size={13} color={colors.textMuted} />
                          <Text style={styles.weightCorrelationText}>
                            Avg Weight: <Text style={styles.weightBold}>{weightInfo.avgWeight} kg</Text>
                            {weightInfo.diff !== undefined && (
                              <Text
                                style={{
                                  color: weightInfo.diff <= 0 ? colors.success : colors.amber,
                                  fontWeight: '700',
                                }}
                              >
                                {' '}
                                ({weightInfo.diff > 0 ? `+${weightInfo.diff}` : `${weightInfo.diff}`} kg change)
                              </Text>
                            )}
                          </Text>
                        </View>
                      )}

                      {weekItem.copilot_insight ? (
                        <View style={styles.weekInsight}>
                          <Sparkles size={13} color={colors.primaryLight} style={{ marginTop: 1 }} />
                          <Text style={styles.weekInsightText}>{weekItem.copilot_insight}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View style={styles.weekEmptyNotice}>
                      <Text style={styles.weekEmptyNoticeText}>No meals logged during this week.</Text>
                    </View>
                  )}
                </Card>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}

      {/* ── Action Banner ── */}
      <Animated.View entering={enter(5)}>
        <PressableScale onPress={onNavigateToNutrition} style={styles.bottomCtaCard}>
          <View style={styles.bottomCtaLeft}>
            <Utensils size={18} color="#FFFFFF" />
            <View>
              <Text style={styles.bottomCtaTitle}>Open Nutrition Daily Tracker</Text>
              <Text style={styles.bottomCtaSub}>Log food, view recipes, and track meals</Text>
            </View>
          </View>
          <ArrowRight size={18} color="#FFFFFF" />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

// ─── Timeframe Filter Bar ─────────────────────────────────────────────────────

function TimeframeFilter({
  selected,
  onChange,
}: {
  selected: Timeframe;
  onChange: (t: Timeframe) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.timeframeRow}>
      {TIMEFRAMES.map((tf) => {
        const active = selected === tf.key;
        return (
          <PressableScale
            key={tf.key}
            haptic="selection"
            onPress={() => onChange(tf.key)}
            style={[styles.timeframeBtn, active && styles.timeframeBtnActive]}
            accessibilityLabel={`Show ${tf.label} data`}
          >
            <Text style={[styles.timeframeBtnText, active && styles.timeframeBtnTextActive]}>
              {tf.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ─── Daily Nutrient SVG Chart ─────────────────────────────────────────────────

interface DailyNutrientChartProps {
  days: NutritionHistoryDay[];
  valueKey: 'total_calories' | 'total_protein' | 'total_carbs' | 'total_fat';
  targetValue: number;
  color: string;
  gradientId: string;
  unit: string;
  formatLabel: (v: number) => string;
  timeframe: Timeframe;
}

function DailyNutrientChart({
  days,
  valueKey,
  targetValue,
  color,
  gradientId,
  unit,
  formatLabel,
  timeframe,
}: DailyNutrientChartProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [layoutWidth, setLayoutWidth] = useState(320);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const CHART_H = 172;
  const PAD_H = 8;
  const PAD_TOP = 24;
  const PAD_BOT = 30;
  const innerW = Math.max(100, layoutWidth - PAD_H * 2);
  const innerH = CHART_H - PAD_TOP - PAD_BOT;

  const values = useMemo(() => days.map((d) => d[valueKey] as number), [days, valueKey]);

  const maxVal = useMemo(() => Math.max(...values, targetValue * 1.1), [values, targetValue]);
  const minVal = useMemo(
    () => Math.min(...values.filter((v) => v > 0), targetValue * 0.82),
    [values, targetValue]
  );
  const chartMin = minVal - (maxVal - minVal) * 0.08;
  const chartMax = maxVal + (maxVal - minVal) * 0.12;
  const valRange = Math.max(chartMax - chartMin, 1);

  const getX = useCallback(
    (i: number) => PAD_H + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW),
    [days.length, innerW]
  );
  const getY = useCallback(
    (v: number) => PAD_TOP + (1 - (v - chartMin) / valRange) * innerH,
    [chartMin, valRange, innerH]
  );

  const targetY = getY(targetValue);

  const points = useMemo(
    () =>
      days.map((d, i) => ({
        x: getX(i),
        y: getY(d[valueKey] as number),
        value: d[valueKey] as number,
        date: d.date,
      })),
    [days, valueKey, getX, getY]
  );

  const linePath = useMemo(
    () => {
      if (points.length < 2) return '';
      return points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`), '');
    },
    [points]
  );
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const bot = CHART_H - PAD_BOT;
    return `${linePath} L ${points[points.length - 1].x},${bot} L ${points[0].x},${bot} Z`;
  }, [linePath, points]);

  const onScrub = useCallback(
    (touchX: number) => {
      if (!points.length) return;
      let idx = 0;
      let best = Math.abs(points[0].x - touchX);
      for (let i = 1; i < points.length; i++) {
        const d = Math.abs(points[i].x - touchX);
        if (d < best) { best = d; idx = i; }
      }
      setScrubIndex((prev) => {
        if (prev !== idx) haptics.selection();
        return idx;
      });
    },
    [points]
  );

  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => { 'worklet'; runOnJS(onScrub)(e.x); })
      .onUpdate((e) => { 'worklet'; runOnJS(onScrub)(e.x); });
    const tap = Gesture.Tap().onEnd((e) => { 'worklet'; runOnJS(onScrub)(e.x); });
    return Gesture.Race(pan, tap);
  }, [onScrub]);

  const activePoint = scrubIndex != null ? points[scrubIndex] : null;

  // Stats
  const avg = useMemo(() => {
    const valid = values.filter((v) => v > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  }, [values]);

  const trend = useMemo(() => {
    const valid = values.filter((v) => v > 0);
    if (valid.length < 2) return null;
    return valid[valid.length - 1] - valid[0];
  }, [values]);

  // Y-axis reference labels
  const yMid = (chartMax + chartMin) / 2;

  // Axis date labels - show up to 5 evenly distributed
  const axisLabels = useMemo(() => {
    if (days.length === 0) return [];
    const maxLabels = 5;
    const step = Math.max(1, Math.floor((days.length - 1) / (maxLabels - 1)));
    const indices = new Set<number>();
    for (let i = 0; i < days.length; i += step) indices.add(Math.min(i, days.length - 1));
    indices.add(days.length - 1);
    return [...indices].sort((a, b) => a - b).map((i) => ({
      x: getX(i),
      label: days[i].date.slice(5), // MM-DD
    }));
  }, [days, getX]);

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={styles.chartContainer}
    >
      {/* Stat pills */}
      <View style={styles.chartStatsRow}>
        <View style={styles.chartStatPill}>
          <Text style={styles.chartStatLabel}>Avg</Text>
          <Text style={[styles.chartStatValue, { color }]}>
            {formatLabel(avg)}{' '}
            <Text style={styles.chartStatUnit}>{unit}</Text>
          </Text>
        </View>
        {trend != null ? (
          <View style={[styles.chartStatPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            {trend < 0 ? (
              <TrendingDown size={12} color={colors.primaryLight} strokeWidth={2.5} />
            ) : trend > 0 ? (
              <TrendingUp size={12} color={colors.amber} strokeWidth={2.5} />
            ) : (
              <Minus size={12} color={colors.textMuted} strokeWidth={2.5} />
            )}
            <Text
              style={[
                styles.chartStatValue,
                {
                  color:
                    valueKey === 'total_calories'
                      ? trend <= 0 ? colors.primaryLight : colors.amber
                      : trend >= 0 ? colors.primaryLight : colors.amber,
                },
              ]}
            >
              {trend > 0 ? `+${formatLabel(trend)}` : formatLabel(trend)}{' '}
              <Text style={styles.chartStatUnit}>{unit}</Text>
            </Text>
          </View>
        ) : days.length === 1 ? (
          <View style={styles.chartStatPill}>
            <Text style={styles.chartStatLabel}>Log</Text>
            <Text style={[styles.chartStatValue, { fontSize: 11, color: colors.textMuted }]}>
              Day 1
            </Text>
          </View>
        ) : null}
        <View style={styles.chartStatPill}>
          <Text style={styles.chartStatLabel}>Target</Text>
          <Text style={styles.chartStatValue}>
            {formatLabel(targetValue)} <Text style={styles.chartStatUnit}>{unit}</Text>
          </Text>
        </View>
      </View>

      {/* SVG */}
      <GestureDetector gesture={composedGesture}>
        <View
          style={{ width: '100%', height: CHART_H }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 50) setLayoutWidth(w);
          }}
        >
          <Svg width={layoutWidth} height={CHART_H}>
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Grid lines */}
            {[0, 0.5, 1].map((ratio, i) => (
              <Line
                key={`g${i}`}
                x1={PAD_H}
                y1={PAD_TOP + ratio * innerH}
                x2={layoutWidth - PAD_H}
                y2={PAD_TOP + ratio * innerH}
                stroke={colors.borderSubtle}
                strokeDasharray="3 4"
                opacity={0.55}
              />
            ))}

            {/* Y-axis labels */}
            <SvgText x={PAD_H} y={PAD_TOP - 5} fontSize="9" fill={colors.textMuted} fontWeight="600">
              {formatLabel(chartMax)}
            </SvgText>
            <SvgText x={PAD_H} y={PAD_TOP + innerH * 0.5 - 3} fontSize="9" fill={colors.textMuted} fontWeight="600">
              {formatLabel(yMid)}
            </SvgText>

            {/* Target dashed line */}
            <Line
              x1={PAD_H}
              y1={targetY}
              x2={layoutWidth - PAD_H}
              y2={targetY}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.5}
            />
            <SvgText
              x={layoutWidth - PAD_H - 2}
              y={targetY - 5}
              textAnchor="end"
              fontSize="9"
              fill={color}
              fontWeight="700"
              opacity={0.75}
            >
              Target
            </SvgText>

            {/* Single point horizontal guideline */}
            {points.length === 1 && (
              <Line
                x1={PAD_H}
                y1={points[0].y}
                x2={layoutWidth - PAD_H}
                y2={points[0].y}
                stroke={color}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                opacity={0.35}
              />
            )}

            {/* Area fill */}
            {areaPath !== '' && <Path d={areaPath} fill={`url(#${gradientId})`} />}

            {/* Line */}
            {linePath !== '' && (
              <Path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Single point halo */}
            {points.length === 1 && (
              <Circle cx={points[0].x} cy={points[0].y} r={10} fill={color} fillOpacity={0.2} />
            )}

            {/* Dots – only when few points */}
            {days.length <= 14 &&
              points.map((pt, i) => (
                <Circle
                  key={`d${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={scrubIndex === i ? 5.5 : 3}
                  fill={scrubIndex === i ? color : colors.surface}
                  stroke={color}
                  strokeWidth={1.5}
                />
              ))}

            {/* Active scrub */}
            {activePoint && (
              <>
                <Line
                  x1={activePoint.x}
                  y1={PAD_TOP}
                  x2={activePoint.x}
                  y2={CHART_H - PAD_BOT}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  opacity={0.65}
                />
                <Circle cx={activePoint.x} cy={activePoint.y} r={8} fill={color} fillOpacity={0.18} />
                <Circle cx={activePoint.x} cy={activePoint.y} r={4.5} fill={color} stroke="#FFFFFF" strokeWidth={2} />
              </>
            )}

            {/* Bottom axis labels */}
            {axisLabels.map((lbl, i) => (
              <SvgText
                key={`ax${i}`}
                x={lbl.x}
                y={CHART_H - 8}
                textAnchor="middle"
                fontSize="9"
                fill={colors.textMuted}
                fontWeight="600"
              >
                {lbl.label}
              </SvgText>
            ))}
          </Svg>

          {/* Floating tooltip */}
          {activePoint && (
            <Animated.View
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(120)}
              style={[
                styles.tooltip,
                {
                  left: Math.max(4, Math.min(layoutWidth - 118, activePoint.x - 57)),
                  borderColor: color,
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.tooltipDate}>{activePoint.date}</Text>
              <Text style={[styles.tooltipValue, { color }]}>
                {formatLabel(activePoint.value)}{' '}
                <Text style={styles.tooltipUnit}>{unit}</Text>
              </Text>
              <View style={styles.tooltipVsTarget}>
                <View
                  style={[
                    styles.tooltipDot,
                    {
                      backgroundColor:
                        activePoint.value <= targetValue ? colors.primaryLight : colors.warning,
                    },
                  ]}
                />
                <Text style={styles.tooltipVsText}>
                  {activePoint.value === targetValue
                    ? 'On target'
                    : activePoint.value > targetValue
                    ? `+${formatLabel(activePoint.value - targetValue)} over`
                    : `${formatLabel(targetValue - activePoint.value)} under`}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

