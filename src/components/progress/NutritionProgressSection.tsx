import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
  TrendingUp,
  Utensils,
  Flame,
  Dumbbell,
  ShieldCheck,
  Check,
  Calendar,
  GlassWater,
  ArrowRight,
  Scale,
  Sparkles,
} from 'lucide-react-native';
import { Card, Badge, Button, PressableScale, ProgressBar } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { formatNumber } from '../../types';
import type { NutritionHistoryResponse, WeightEntry, WeeklyNutritionSummary } from '../../types';
import { computeWeeklyNutritionSummaries, calculateMacroRatio } from '../../lib/nutritionWeeks';
import { haptics } from '../../lib/haptics';

interface NutritionProgressSectionProps {
  nutritionHistory?: NutritionHistoryResponse | null;
  weights?: WeightEntry[];
  isLoading?: boolean;
  onNavigateToNutrition: () => void;
}

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(380);

export function NutritionProgressSection({
  nutritionHistory,
  weights = [],
  isLoading,
  onNavigateToNutrition,
}: NutritionProgressSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  // Compute weeks from history
  const weeks: WeeklyNutritionSummary[] = useMemo(() => {
    if (!nutritionHistory?.history) return [];
    return computeWeeklyNutritionSummaries(
      nutritionHistory.history,
      nutritionHistory.targets,
      nutritionHistory.plan?.mode
    );
  }, [nutritionHistory]);

  const currentWeek = weeks[0];
  const targetCalories = currentWeek?.target_calories || nutritionHistory?.targets?.daily_calories || 2200;
  const targetProtein = currentWeek?.target_protein || nutritionHistory?.targets?.protein_g || 160;

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
        const diff = weekWeights.length > 1
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

  if (!weeks.length) {
    return (
      <Card style={styles.emptyCard}>
        <Utensils size={32} color={colors.primaryLight} />
        <Text style={styles.emptyTitle}>No nutrition history yet</Text>
        <Text style={styles.emptySub}>
          Log your meals in the Nutrition tab to start tracking weekly average nutrients, calorie trends, and adherence.
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

  // Weeks ordered oldest to newest for the SVG chart (max 8 weeks)
  const chartWeeks = [...weeks].slice(0, 8).reverse();

  return (
    <View style={styles.container}>
      {/* 1. Metric Overview Cards Row */}
      <Animated.View entering={enter(0)} style={styles.metricsRow}>
        {/* Calories Card */}
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>This Week Avg</Text>
          <Text style={styles.metricValue}>
            {currentWeek?.avg_calories ? formatNumber(currentWeek.avg_calories) : '--'}
            <Text style={styles.metricUnit}> kcal</Text>
          </Text>
          <Text style={styles.metricTarget}>Target: {formatNumber(targetCalories)} kcal</Text>
          <View style={styles.metricAdherenceRow}>
            <View
              style={[
                styles.metricStatusDot,
                {
                  backgroundColor:
                    (currentWeek?.avg_calories || 0) <= targetCalories
                      ? colors.primaryLight
                      : colors.warning,
                },
              ]}
            />
            <Text style={styles.metricAdherenceText}>
              {currentWeek?.logged_count
                ? currentWeek.avg_calories <= targetCalories
                  ? `${targetCalories - currentWeek.avg_calories} kcal under ceiling`
                  : `${currentWeek.avg_calories - targetCalories} kcal over ceiling`
                : 'No logs yet'}
            </Text>
          </View>
        </Card>

        {/* Protein Card */}
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Protein Avg</Text>
          <Text style={styles.metricValue}>
            {currentWeek?.avg_protein ? currentWeek.avg_protein : '--'}
            <Text style={styles.metricUnit}> g</Text>
          </Text>
          <Text style={styles.metricTarget}>Target: {formatNumber(targetProtein)} g</Text>
          <View style={styles.metricAdherenceRow}>
            <View
              style={[
                styles.metricStatusDot,
                {
                  backgroundColor:
                    (currentWeek?.avg_protein || 0) >= targetProtein
                      ? colors.success
                      : colors.cyan,
                },
              ]}
            />
            <Text style={styles.metricAdherenceText}>
              {currentWeek?.protein_adherence_pct || 0}% target met
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* 2. Weekly Average Calorie SVG Trend Chart */}
      {chartWeeks.length > 1 && (
        <Animated.View entering={enter(1)}>
          <Card elevated style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Weekly Average Nutrients Trend</Text>
                <Text style={styles.chartSub}>Weekly average intake over time</Text>
              </View>
              <Badge
                label={`${currentWeek.logged_count}/7 Days Logged`}
                tone={currentWeek.logged_count >= 5 ? 'emerald' : 'amber'}
              />
            </View>

            <WeeklyCaloriesSvgChart
              chartWeeks={chartWeeks}
              targetCalories={targetCalories}
            />

            {/* Caloric Energy Split */}
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
      )}

      {/* 3. Week-by-Week Nutrient Averages History */}
      <Animated.View entering={enter(2)}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Week-by-Week Nutrient Breakdown</Text>
          <Text style={styles.sectionSub}>{weeks.length} weeks tracked</Text>
        </View>

        {weeks.map((weekItem, index) => {
          const isCurrent = index === 0;
          const weightInfo = weightByWeek.get(weekItem.week_start);
          const diff = weekItem.avg_calories - weekItem.target_calories;
          const isMet = weekItem.avg_calories > 0 && diff <= 0;

          return (
            <Animated.View key={weekItem.week_start} entering={enter(3 + Math.min(index, 5))}>
              <Card elevated={isCurrent} style={[styles.weekCard, isCurrent && styles.currentWeekCard]}>
                {/* Header: Week Label & Adherence */}
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

                {/* Nutrients Averages Grid */}
                {weekItem.logged_count > 0 ? (
                  <>
                    <View style={styles.weekNutrientsRow}>
                      {/* Calories */}
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

                      {/* Protein */}
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

                      {/* Carbs */}
                      <View style={styles.nutrientPill}>
                        <View style={[styles.dotSmall, { backgroundColor: colors.amber }]} />
                        <Text style={styles.nutrientPillLabel}>Carbs</Text>
                        <Text style={styles.nutrientPillVal}>
                          {Math.round(weekItem.avg_carbs)}
                          <Text style={styles.nutrientPillUnit}>g/d</Text>
                        </Text>
                        <Text style={styles.nutrientPillTarget}>/{weekItem.target_carbs}g</Text>
                      </View>

                      {/* Fat */}
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

                    {/* Weight correlation line if logged */}
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

                    {/* Coach insight */}
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

      {/* 4. Action Banner */}
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

/**
 * Native SVG Line & Bar chart for weekly average calories
 */
function WeeklyCaloriesSvgChart({
  chartWeeks,
  targetCalories,
}: {
  chartWeeks: WeeklyNutritionSummary[];
  targetCalories: number;
}) {
  const { colors } = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(320);
  const chartHeight = 160;
  const paddingBottom = 28;
  const paddingTop = 20;
  const paddingHorizontal = 24;

  const validCalories = chartWeeks.map((w) => w.avg_calories || 0);
  const maxCal = Math.max(targetCalories * 1.25, ...validCalories, 2400);
  const minCal = Math.min(targetCalories * 0.7, Math.min(...validCalories.filter((c) => c > 0)), 1500);

  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const usableWidth = Math.max(100, layoutWidth - paddingHorizontal * 2);

  const getY = (val: number) => {
    const clamped = Math.max(minCal, Math.min(maxCal, val));
    const ratio = (clamped - minCal) / Math.max(1, maxCal - minCal);
    return paddingTop + (1 - ratio) * usableHeight;
  };

  const getX = (index: number) => {
    if (chartWeeks.length <= 1) return paddingHorizontal + usableWidth / 2;
    return paddingHorizontal + (index / (chartWeeks.length - 1)) * usableWidth;
  };

  const targetY = getY(targetCalories);

  // Path generator for line chart
  const points = chartWeeks.map((w, i) => ({
    x: getX(i),
    y: getY(w.avg_calories || targetCalories),
    cal: w.avg_calories,
    logged: w.logged_count > 0,
    label: w.label === 'This Week' ? 'Now' : w.label === 'Last Week' ? 'Prev' : `W${chartWeeks.length - i}`,
  }));

  let pathD = '';
  points.forEach((p, idx) => {
    if (idx === 0) pathD += `M ${p.x} ${p.y}`;
    else pathD += ` L ${p.x} ${p.y}`;
  });

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 50) setLayoutWidth(w);
      }}
      style={{ width: '100%', height: chartHeight, marginVertical: spacing.sm }}
    >
      <Svg width={layoutWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="calLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.primaryLight} />
            <Stop offset="100%" stopColor={colors.cyan} />
          </LinearGradient>
        </Defs>

        {/* Target Dashed Line */}
        <Line
          x1={paddingHorizontal}
          y1={targetY}
          x2={layoutWidth - paddingHorizontal}
          y2={targetY}
          stroke={colors.primaryLight}
          strokeWidth={1.5}
          strokeDasharray="4,4"
          opacity={0.6}
        />
        <SvgText
          x={layoutWidth - paddingHorizontal}
          y={targetY - 6}
          textAnchor="end"
          fontSize="10"
          fill={colors.primaryLight}
          fontWeight="700"
        >
          Target: {formatNumber(targetCalories)}
        </SvgText>

        {/* Connecting Line */}
        {points.length > 1 && (
          <Path
            d={pathD}
            fill="none"
            stroke="url(#calLineGrad)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Data points */}
        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Circle
              cx={p.x}
              cy={p.y}
              r={p.logged ? 5 : 3}
              fill={p.logged ? colors.primaryLight : colors.borderBright}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            {/* Calorie text label above point */}
            {p.logged && (
              <SvgText
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                fontSize="10"
                fill={colors.textPrimary}
                fontWeight="800"
              >
                {p.cal}
              </SvgText>
            )}
            {/* Bottom week label */}
            <SvgText
              x={p.x}
              y={chartHeight - 6}
              textAnchor="middle"
              fontSize="10"
              fill={colors.textMuted}
              fontWeight="600"
            >
              {p.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metricTarget: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricAdherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  metricStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricAdherenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chartCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  chartSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  macroSplitContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  macroSplitTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  macroSplitBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: colors.surfaceElevated,
  },
  macroSplitSeg: {
    height: '100%',
  },
  macroSplitLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
  },
  macroSplitText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  weekCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentWeekCard: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceElevated,
  },
  weekCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekDates: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  weekNutrientsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xs,
  },
  nutrientPill: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  dotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nutrientPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  nutrientPillVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  nutrientPillUnit: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
  },
  nutrientPillDelta: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  nutrientPillTarget: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  weightCorrelationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  weightCorrelationText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  weightBold: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.primarySurface,
    padding: spacing.xs + 2,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  weekInsightText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 15,
  },
  weekEmptyNotice: {
    paddingVertical: spacing.sm,
  },
  weekEmptyNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  bottomCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  bottomCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bottomCtaTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomCtaSub: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
}));
