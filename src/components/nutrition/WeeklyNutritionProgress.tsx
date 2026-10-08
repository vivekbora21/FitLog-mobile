import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Flame,
  Dumbbell,
  ShieldCheck,
  Check,
  Plus,
  Utensils,
  Calendar,
  GlassWater,
  RotateCcw,
  Sparkles,
  History,
} from 'lucide-react-native';
import { Card, Badge, Button, PressableScale, ProgressBar } from '../ui';
import { NutritionHeroCard } from './NutritionHeroCard';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { formatNumber } from '../../types';
import type { MacroTarget, NutritionHistoryDay, WeeklyNutritionDayItem, WeeklyNutritionSummary } from '../../types';
import { calculateMacroRatio, computeWeeklyNutritionSummaries } from '../../lib/nutritionWeeks';
import { formatDayLabel, toDateKey } from '../../lib/format';
import { haptics } from '../../lib/haptics';

interface WeeklyNutritionProgressProps {
  history: NutritionHistoryDay[];
  targets?: MacroTarget | null;
  planMode?: string;
  targetType?: 'MAX' | 'MIN' | 'TARGET';
  selectedDate?: string;
  onSelectDate: (dateKey: string) => void;
  onLogMealForDate?: (dateKey: string) => void;
}

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(380);

export function WeeklyNutritionProgress({
  history,
  targets,
  planMode = 'CUT',
  targetType = 'MAX',
  selectedDate,
  onSelectDate,
  onLogMealForDate,
}: WeeklyNutritionProgressProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const todayKey = toDateKey(new Date());

  // Compute all weekly summaries
  const weeks = useMemo(() => {
    return computeWeeklyNutritionSummaries(history, targets, planMode);
  }, [history, targets, planMode]);

  // Selected week index (0 = This Week, 1 = Last Week...)
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  // Active week summary
  const [entriesLimit, setEntriesLimit] = useState<5 | 7>(5);

  const activeWeek: WeeklyNutritionSummary | undefined = weeks[selectedWeekIndex] || weeks[0];

  const isCut = targetType === 'MAX' || planMode === 'CUT';
  const isBulk = targetType === 'MIN' || planMode === 'BULK';

  // Calculate macro ratios from weekly averages
  const macroRatios = useMemo(() => {
    if (!activeWeek) return { proteinPct: 30, carbsPct: 45, fatPct: 25 };
    return calculateMacroRatio(activeWeek.avg_protein, activeWeek.avg_carbs, activeWeek.avg_fat);
  }, [activeWeek]);

  const safeWeek = activeWeek ?? ({ days: [] } as unknown as WeeklyNutritionSummary);

  const {
    avg_calories,
    avg_protein,
    avg_carbs,
    avg_fat,
    avg_water_ml,
    target_calories,
    target_protein,
    target_carbs,
    target_fat,
    target_water,
    logged_count,
    total_days,
    net_calorie_diff,
    calorie_adherence_pct,
    protein_adherence_pct,
    copilot_insight,
    days,
  } = safeWeek;

  // Find maximum calorie day for the bar chart scaling
  const maxDayCalories = Math.max(target_calories * 1.25, ...days.map((d) => d.total_calories), 2400);

  const visibleDays = useMemo(() => {
    if (entriesLimit === 7) return days;
    return days.slice(0, 5);
  }, [days, entriesLimit]);

  if (!activeWeek) return null;

  const calDiff = avg_calories - target_calories;
  const isProteinMet = target_protein > 0 && avg_protein >= target_protein;
  const weeklyCalorieBudget = target_calories * 7;
  const weeklyCaloriesConsumed = days.reduce((sum, d) => sum + d.total_calories, 0);

  // Calorie ring status
  let ringColor = colors.primaryLight;
  let ringGradient = colors.cyan;
  let ringValueColor = colors.textPrimary;
  let statusBadgeLabel = `${logged_count}/7 Days Logged`;
  let statusBadgeTone: 'emerald' | 'cyan' | 'amber' | 'slate' = 'slate';

  if (logged_count >= 5) {
    statusBadgeTone = 'emerald';
  } else if (logged_count >= 3) {
    statusBadgeTone = 'cyan';
  } else if (logged_count > 0) {
    statusBadgeTone = 'amber';
  }

  if (isCut) {
    if (avg_calories <= target_calories && logged_count > 0) {
      ringColor = colors.primaryLight;
      ringGradient = colors.cyan;
    } else if (logged_count > 0) {
      ringColor = colors.warning;
      ringGradient = colors.rose;
      ringValueColor = colors.warning;
    }
  } else if (isBulk) {
    if (avg_calories >= target_calories && logged_count > 0) {
      ringColor = colors.success;
      ringGradient = colors.cyan;
    } else if (logged_count > 0) {
      ringColor = colors.amber;
      ringGradient = colors.primaryLight;
    }
  }


  const handlePrevWeek = () => {
    if (selectedWeekIndex < weeks.length - 1) {
      haptics.selection();
      setSelectedWeekIndex((i) => i + 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeekIndex > 0) {
      haptics.selection();
      setSelectedWeekIndex((i) => i - 1);
    }
  };

  const handleResetToCurrent = () => {
    haptics.selection();
    setSelectedWeekIndex(0);
  };

  return (
    <View style={styles.container}>
      {/* 1. Week Navigation Bar */}
      <Animated.View entering={enter(0)}>
        <Card style={styles.weekNavCard}>
          <PressableScale
            onPress={handlePrevWeek}
            disabled={selectedWeekIndex >= weeks.length - 1}
            style={[styles.weekNavArrow, selectedWeekIndex >= weeks.length - 1 && styles.weekNavArrowDisabled]}
            accessibilityLabel="Previous week"
          >
            <ChevronLeft size={20} color={selectedWeekIndex >= weeks.length - 1 ? colors.textMuted : colors.textPrimary} />
          </PressableScale>

          <View style={styles.weekNavCenter}>
            <View style={styles.weekNavTitleRow}>
              <Calendar size={14} color={colors.primaryLight} />
              <Text style={styles.weekNavTitle}>{activeWeek.label}</Text>
            </View>
            <Text style={styles.weekNavSub}>
              {activeWeek.week_start} – {activeWeek.week_end}
            </Text>
          </View>

          <PressableScale
            onPress={handleNextWeek}
            disabled={selectedWeekIndex <= 0}
            style={[styles.weekNavArrow, selectedWeekIndex <= 0 && styles.weekNavArrowDisabled]}
            accessibilityLabel="Next week"
          >
            <ChevronRight size={20} color={selectedWeekIndex <= 0 ? colors.textMuted : colors.textPrimary} />
          </PressableScale>
        </Card>
      </Animated.View>

      {/* "Back to This Week" banner when browsing past weeks */}
      {selectedWeekIndex > 0 && (
        <Animated.View entering={enter(1)}>
          <PressableScale onPress={handleResetToCurrent} style={styles.resetWeekBtn}>
            <RotateCcw size={13} color={colors.primaryLight} />
            <Text style={styles.resetWeekBtnText}>Viewing past history · Jump to Current Week</Text>
          </PressableScale>
        </Animated.View>
      )}

      {/* 2. Hero: Weekly Average Daily Calories & Goal Adherence */}
      <Animated.View entering={enter(2)}>
        <NutritionHeroCard
          headerTitle="Weekly Average Nutrients"
          headerSubtitle={isCut ? 'Deficit Target Track' : isBulk ? 'Surplus Growth Floor' : 'Maintenance Pace'}
          headerIcon={
            <View
              style={[
                styles.planIconCircle,
                { backgroundColor: isBulk ? `${colors.amber}22` : isCut ? `${colors.primaryLight}22` : `${colors.cyan}22` },
              ]}
            >
              {isBulk ? (
                <Dumbbell size={16} color={colors.amber} />
              ) : isCut ? (
                <Flame size={16} color={colors.primaryLight} />
              ) : (
                <ShieldCheck size={16} color={colors.cyan} />
              )}
            </View>
          }
          headerBadgeLabel={statusBadgeLabel}
          headerBadgeTone={statusBadgeTone}
          percentage={calorie_adherence_pct}
          gaugeColor={ringColor}
          gaugeGradient={ringGradient}
          centerIcon={
            isBulk ? (
              <Dumbbell size={14} color={colors.amber} />
            ) : isCut ? (
              <Flame size={14} color={colors.primaryLight} />
            ) : (
              <ShieldCheck size={14} color={colors.cyan} />
            )
          }
          primaryValue={avg_calories > 0 ? formatNumber(avg_calories) : '--'}
          primaryValueColor={ringValueColor}
          primaryLabel="kcal / day avg"
          statusBadgeText={
            logged_count === 0
              ? 'No logs yet'
              : calDiff === 0
              ? 'On Target'
              : isCut
              ? calDiff < 0
                ? `${Math.abs(calDiff)} kcal Under`
                : `+${calDiff} kcal Over`
              : calDiff >= 0
              ? `+${calDiff} kcal Surplus`
              : `${Math.abs(calDiff)} kcal Needed`
          }
          statusBadgeTone={
            logged_count === 0
              ? 'slate'
              : calDiff === 0
              ? 'cyan'
              : isCut
              ? calDiff < 0
                ? 'emerald'
                : 'rose'
              : calDiff >= 0
              ? 'emerald'
              : 'amber'
          }
          stats={[
            {
              label: 'Daily Avg',
              value: avg_calories > 0 ? formatNumber(avg_calories) : '--',
              unit: avg_calories > 0 ? 'kcal' : undefined,
              icon: <Utensils size={11} color={colors.primaryLight} />,
            },
            {
              label: isBulk ? 'Min Floor' : isCut ? 'Deficit Max' : 'Goal',
              value: formatNumber(target_calories),
              unit: 'kcal',
              icon: <ShieldCheck size={11} color={colors.cyan} />,
            },
            {
              label: 'Weekly Pace',
              value:
                logged_count === 0
                  ? '--'
                  : calDiff === 0
                  ? 'On Target'
                  : isCut
                  ? calDiff < 0
                    ? `${Math.abs(calDiff)} Under`
                    : `${calDiff} Over`
                  : calDiff >= 0
                  ? `+${calDiff} Surplus`
                  : `${Math.abs(calDiff)} Needed`,
              highlight: true,
              accentColor:
                logged_count === 0
                  ? colors.textMuted
                  : isCut
                  ? calDiff <= 0
                    ? colors.primaryLight
                    : colors.rose
                  : calDiff >= 0
                  ? colors.success
                  : colors.amber,
              badgeText:
                logged_count === 0
                  ? undefined
                  : calDiff === 0
                  ? 'Target'
                  : isCut
                  ? calDiff <= 0
                    ? 'Pacing Deficit'
                    : 'Over Budget'
                  : calDiff >= 0
                  ? 'Pacing Surplus'
                  : 'Under Target',
              badgeTone:
                logged_count === 0
                  ? 'slate'
                  : calDiff === 0
                  ? 'cyan'
                  : isCut
                  ? calDiff <= 0
                    ? 'emerald'
                    : 'rose'
                  : calDiff >= 0
                  ? 'emerald'
                  : 'amber',
              icon: (
                <TrendingUp
                  size={11}
                  color={
                    logged_count === 0
                      ? colors.textMuted
                      : isCut
                      ? calDiff <= 0
                        ? colors.primaryLight
                        : colors.rose
                      : colors.success
                  }
                />
              ),
            },
          ]}
        >
          {/* Weekly Total Budget Bar */}
          {logged_count > 0 && (
            <View style={styles.netDiffPill}>
              <View style={styles.netDiffRow}>
                <Text style={styles.netDiffLabel}>
                  Weekly Total: <Text style={styles.netDiffBold}>{formatNumber(weeklyCaloriesConsumed)}</Text> / {formatNumber(weeklyCalorieBudget)} kcal
                </Text>
                <Text
                  style={[
                    styles.netDiffDelta,
                    { color: net_calorie_diff <= 0 ? colors.cyan : colors.amber },
                  ]}
                >
                  {net_calorie_diff > 0 ? `+${formatNumber(net_calorie_diff)}` : formatNumber(net_calorie_diff)} kcal
                </Text>
              </View>
              <ProgressBar
                percentage={Math.min(100, Math.round((weeklyCaloriesConsumed / Math.max(1, weeklyCalorieBudget)) * 100))}
                color={isCut && weeklyCaloriesConsumed > weeklyCalorieBudget ? colors.warning : colors.primaryLight}
                height={6}
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          {/* Copilot Insight note */}
          <View style={styles.insightBox}>
            <Sparkles size={15} color={colors.primaryLight} style={{ marginTop: 1 }} />
            <Text style={styles.insightText}>{copilot_insight}</Text>
          </View>
        </NutritionHeroCard>
      </Animated.View>

      {/* 3. Daily Nutrient Averages Grid (Protein, Carbs, Fat, Water) */}
      <Animated.View entering={enter(3)}>
        <Text style={styles.subSectionTitle}>Average Daily Macro Intake</Text>
        <View style={styles.macroGrid}>
          {/* Protein */}
          <View style={styles.macroCard}>
            <View style={styles.macroCardTop}>
              <View style={[styles.macroDot, { backgroundColor: colors.cyan }]} />
              <Text style={styles.macroCardTitle}>Protein</Text>
              {isProteinMet && <Check size={14} color={colors.success} />}
            </View>
            <Text style={styles.macroCardValue}>
              {avg_protein > 0 ? avg_protein : '--'}
              <Text style={styles.macroCardUnit}>g</Text>
            </Text>
            <Text style={styles.macroCardTarget}>Target: {formatNumber(target_protein)}g / day</Text>
            <ProgressBar
              percentage={protein_adherence_pct}
              color={colors.cyan}
              height={5}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.macroCardAdherence}>
              {protein_adherence_pct}% of goal
            </Text>
          </View>

          {/* Carbs */}
          <View style={styles.macroCard}>
            <View style={styles.macroCardTop}>
              <View style={[styles.macroDot, { backgroundColor: colors.amber }]} />
              <Text style={styles.macroCardTitle}>Carbs</Text>
            </View>
            <Text style={styles.macroCardValue}>
              {avg_carbs > 0 ? avg_carbs : '--'}
              <Text style={styles.macroCardUnit}>g</Text>
            </Text>
            <Text style={styles.macroCardTarget}>Target: {formatNumber(target_carbs)}g / day</Text>
            <ProgressBar
              percentage={target_carbs > 0 ? Math.round((avg_carbs / target_carbs) * 100) : 0}
              color={colors.amber}
              height={5}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.macroCardAdherence}>
              {target_carbs > 0 ? Math.round((avg_carbs / target_carbs) * 100) : 0}% of goal
            </Text>
          </View>

          {/* Fat */}
          <View style={styles.macroCard}>
            <View style={styles.macroCardTop}>
              <View style={[styles.macroDot, { backgroundColor: colors.violet }]} />
              <Text style={styles.macroCardTitle}>Fats</Text>
            </View>
            <Text style={styles.macroCardValue}>
              {avg_fat > 0 ? avg_fat : '--'}
              <Text style={styles.macroCardUnit}>g</Text>
            </Text>
            <Text style={styles.macroCardTarget}>Target: {formatNumber(target_fat)}g / day</Text>
            <ProgressBar
              percentage={target_fat > 0 ? Math.round((avg_fat / target_fat) * 100) : 0}
              color={colors.violet}
              height={5}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.macroCardAdherence}>
              {target_fat > 0 ? Math.round((avg_fat / target_fat) * 100) : 0}% of goal
            </Text>
          </View>

          {/* Water */}
          <View style={styles.macroCard}>
            <View style={styles.macroCardTop}>
              <GlassWater size={13} color={colors.blue} />
              <Text style={styles.macroCardTitle}>Hydration</Text>
            </View>
            <Text style={styles.macroCardValue}>
              {avg_water_ml > 0 ? (avg_water_ml / 1000).toFixed(1) : '--'}
              <Text style={styles.macroCardUnit}>L</Text>
            </Text>
            <Text style={styles.macroCardTarget}>Target: {(target_water / 1000).toFixed(1)}L / day</Text>
            <ProgressBar
              percentage={target_water > 0 ? Math.round((avg_water_ml / target_water) * 100) : 0}
              color={colors.blue}
              height={5}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.macroCardAdherence}>
              {target_water > 0 ? Math.round((avg_water_ml / target_water) * 100) : 0}% of goal
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* 4. Caloric Macro Ratio Bar */}
      <Animated.View entering={enter(4)}>
        <Card style={styles.ratioCard}>
          <View style={styles.ratioHeader}>
            <Text style={styles.ratioTitle}>Average Calorie Breakdown</Text>
            <Text style={styles.ratioSub}>Energy contribution</Text>
          </View>

          {/* Stacked Horizontal Bar */}
          <View style={styles.stackedBar}>
            <View style={[styles.stackedSegment, { flex: macroRatios.proteinPct, backgroundColor: colors.cyan }]} />
            <View style={[styles.stackedSegment, { flex: macroRatios.carbsPct, backgroundColor: colors.amber }]} />
            <View style={[styles.stackedSegment, { flex: macroRatios.fatPct, backgroundColor: colors.violet }]} />
          </View>

          {/* Legend */}
          <View style={styles.ratioLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.cyan }]} />
              <Text style={styles.legendText}>
                Protein: <Text style={styles.legendBold}>{macroRatios.proteinPct}%</Text>
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
              <Text style={styles.legendText}>
                Carbs: <Text style={styles.legendBold}>{macroRatios.carbsPct}%</Text>
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.violet }]} />
              <Text style={styles.legendText}>
                Fat: <Text style={styles.legendBold}>{macroRatios.fatPct}%</Text>
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* 5. 7-Day Calorie Bar Chart */}
      <Animated.View entering={enter(5)}>
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>7-Day Calorie Breakdown</Text>
              <Text style={styles.chartSubtitle}>Tap any bar to inspect or log meals</Text>
            </View>
            <View style={styles.chartTargetLegend}>
              <View style={styles.dashedTargetLegend} />
              <Text style={styles.chartTargetLegendText}>Target: {formatNumber(target_calories)} kcal</Text>
            </View>
          </View>

          {/* Bars Container */}
          <View style={styles.barsContainer}>
            {/* Target Line overlay */}
            <View
              style={[
                styles.chartTargetLine,
                {
                  bottom: Math.min(130, Math.max(20, (target_calories / maxDayCalories) * 130)) + 30,
                },
              ]}
            />

            {days.map((dayItem) => {
              const isSelected = dayItem.date === selectedDate;
              const hasLogged = dayItem.has_logged;
              const cal = dayItem.total_calories;
              const barHeight = hasLogged ? Math.min(130, Math.max(8, (cal / maxDayCalories) * 130)) : 4;

              let barColor = colors.primaryLight;
              if (!hasLogged) {
                barColor = colors.track;
              } else if (isCut) {
                barColor = cal <= target_calories ? colors.primaryLight : colors.warning;
              } else if (isBulk) {
                barColor = cal >= target_calories ? colors.success : colors.amber;
              }

              return (
                <PressableScale
                  key={dayItem.date}
                  onPress={() => {
                    haptics.selection();
                    onSelectDate(dayItem.date);
                  }}
                  style={[styles.barCol, isSelected && styles.barColSelected]}
                  accessibilityLabel={`${dayItem.weekday}, ${dayItem.date}: ${cal} calories. ${hasLogged ? 'Logged' : 'No entries'}`}
                >
                  {/* Calorie text above bar */}
                  <Text style={[styles.barCalText, isSelected && { color: colors.primaryLight, fontWeight: '800' }]}>
                    {hasLogged ? (cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : cal) : '-'}
                  </Text>

                  {/* Vertical Bar */}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        },
                        isSelected && {
                          borderColor: '#FFFFFF',
                          borderWidth: 1,
                        },
                      ]}
                    />
                  </View>

                  {/* Day of Week & Date */}
                  <View style={[styles.dayLabelPill, dayItem.is_today && styles.dayLabelPillToday]}>
                    <Text
                      style={[
                        styles.barWeekday,
                        dayItem.is_today && { color: colors.primaryLight, fontWeight: '800' },
                        isSelected && { color: colors.textPrimary, fontWeight: '800' },
                      ]}
                    >
                      {dayItem.weekday.charAt(0)}
                    </Text>
                    <Text
                      style={[
                        styles.barDayNumber,
                        dayItem.is_today && { color: colors.primaryLight, fontWeight: '800' },
                        isSelected && { color: colors.textPrimary, fontWeight: '800' },
                      ]}
                    >
                      {dayItem.day_number}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </Card>
      </Animated.View>

      {/* 6. Day-by-Day Adherence List */}
      <Animated.View entering={enter(6)}>
        <View style={styles.historySectionHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.historyTitleRow}>
              <History size={16} color={colors.primaryLight} />
              <Text style={styles.subSectionTitle}>
                {selectedWeekIndex === 0 ? 'Daily Logs for this Week' : `Daily Logs · ${activeWeek.label}`}
              </Text>
            </View>
            <Text style={styles.historySubhead}>
              {entriesLimit === 5 ? 'Showing latest 5 entries' : 'Showing all 7 entries'} · {activeWeek.label}
            </Text>
          </View>

          {/* 5 vs 7 entries toggle */}
          <View style={styles.entriesToggleWrap}>
            <PressableScale
              haptic="selection"
              onPress={() => {
                haptics.selection();
                setEntriesLimit(5);
              }}
              style={[styles.entriesToggleBtn, entriesLimit === 5 && styles.entriesToggleBtnActive]}
              accessibilityLabel="Show latest 5 entries"
            >
              <Text style={[styles.entriesToggleText, entriesLimit === 5 && styles.entriesToggleTextActive]}>
                5 Entries
              </Text>
            </PressableScale>
            <PressableScale
              haptic="selection"
              onPress={() => {
                haptics.selection();
                setEntriesLimit(7);
              }}
              style={[styles.entriesToggleBtn, entriesLimit === 7 && styles.entriesToggleBtnActive]}
              accessibilityLabel="Show all 7 entries"
            >
              <Text style={[styles.entriesToggleText, entriesLimit === 7 && styles.entriesToggleTextActive]}>
                7 Entries
              </Text>
            </PressableScale>
          </View>
        </View>

        <Card style={styles.daysListCard}>
          {visibleDays.map((dayItem, idx) => {
            const isSelected = dayItem.date === selectedDate;
            const diff = dayItem.total_calories - target_calories;

            return (
              <View
                key={dayItem.date}
                style={[
                  styles.dayRow,
                  idx > 0 && styles.dayRowBorder,
                  isSelected && styles.dayRowSelected,
                ]}
              >
                <PressableScale
                  haptic="selection"
                  onPress={() => {
                    haptics.selection();
                    onSelectDate(dayItem.date);
                  }}
                  style={styles.dayRowLeft}
                  accessibilityLabel={`View log for ${dayItem.weekday}, ${dayItem.date}`}
                >
                  <View style={[styles.dayRowBadge, dayItem.is_today && styles.dayRowBadgeToday]}>
                    <Text style={[styles.dayRowWeekday, dayItem.is_today && { color: colors.primaryLight }]}>
                      {dayItem.weekday}
                    </Text>
                    <Text style={[styles.dayRowNumber, dayItem.is_today && { color: colors.primaryLight }]}>
                      {dayItem.day_number}
                    </Text>
                  </View>

                  <View style={styles.dayRowInfo}>
                    <View style={styles.dayRowTitleLine}>
                      <Text style={styles.dayRowTitle}>
                        {dayItem.is_today
                          ? `Today · ${dayItem.weekday}`
                          : formatDayLabel(dayItem.date)}
                      </Text>
                      {isSelected && <Badge label="Viewing" tone="cyan" />}
                    </View>

                    {dayItem.has_logged ? (
                      <View style={styles.dayRowMacros}>
                        <Text style={styles.dayRowMacroItem}>
                          P: <Text style={styles.dayRowMacroVal}>{Math.round(dayItem.total_protein)}g</Text>
                        </Text>
                        <Text style={styles.dayRowMacroDot}>·</Text>
                        <Text style={styles.dayRowMacroItem}>
                          C: <Text style={styles.dayRowMacroVal}>{Math.round(dayItem.total_carbs)}g</Text>
                        </Text>
                        <Text style={styles.dayRowMacroDot}>·</Text>
                        <Text style={styles.dayRowMacroItem}>
                          F: <Text style={styles.dayRowMacroVal}>{Math.round(dayItem.total_fat)}g</Text>
                        </Text>
                        {dayItem.water_consumed_ml > 0 && (
                          <>
                            <Text style={styles.dayRowMacroDot}>·</Text>
                            <Text style={styles.dayRowMacroItem}>
                              {(dayItem.water_consumed_ml / 1000).toFixed(1)}L
                            </Text>
                          </>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.dayRowEmptyText}>
                        {dayItem.is_future ? 'Upcoming day' : 'No meals logged'}
                      </Text>
                    )}
                  </View>
                </PressableScale>

                {/* Right side: Calories & status */}
                <View style={styles.dayRowRight}>
                  {dayItem.has_logged ? (
                    <PressableScale
                      onPress={() => {
                        haptics.selection();
                        onSelectDate(dayItem.date);
                      }}
                      style={styles.dayRowCalBtn}
                    >
                      <Text style={styles.dayRowCalories}>
                        {formatNumber(dayItem.total_calories)}{' '}
                        <Text style={styles.dayRowCalTarget}>kcal</Text>
                      </Text>
                      <Text
                        style={[
                          styles.dayRowDelta,
                          {
                            color: isCut
                              ? diff <= 0
                                ? colors.success
                                : colors.warning
                              : diff >= 0
                              ? colors.success
                              : colors.amber,
                          },
                        ]}
                      >
                        {diff === 0 ? 'On target' : diff > 0 ? `+${diff}` : `${diff}`}
                      </Text>
                    </PressableScale>
                  ) : onLogMealForDate && !dayItem.is_future ? (
                    <PressableScale
                      onPress={() => onLogMealForDate(dayItem.date)}
                      style={styles.dayRowQuickLog}
                      accessibilityLabel={`Log food for ${dayItem.date}`}
                    >
                      <Plus size={13} color={colors.primaryLight} strokeWidth={2.5} />
                      <Text style={styles.dayRowQuickLogText}>Log</Text>
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            );
          })}

          {/* Bottom toggle action button */}
          <View style={styles.daysListActionsRow}>
            <PressableScale
              haptic="selection"
              onPress={() => {
                haptics.selection();
                setEntriesLimit((c) => (c === 5 ? 7 : 5));
              }}
              style={styles.daysListActionBtn}
              accessibilityLabel={entriesLimit === 5 ? 'Show all 7 entries' : 'Show latest 5 entries'}
            >
              {entriesLimit === 5 ? (
                <ChevronDown size={14} color={colors.primaryLight} />
              ) : (
                <ChevronUp size={14} color={colors.primaryLight} />
              )}
              <Text style={styles.daysListActionText}>
                {entriesLimit === 5 ? 'Show all 7 entries' : 'Show latest 5 entries'}
              </Text>
            </PressableScale>
          </View>
        </Card>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  weekNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  weekNavArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  weekNavArrowDisabled: {
    opacity: 0.4,
  },
  weekNavCenter: {
    alignItems: 'center',
  },
  weekNavTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekNavTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekNavSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  resetWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primarySurface,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  resetWeekBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  heroCard: {
    padding: spacing.xl,
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroHeaderSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  heroTop: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  ringNumber: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  ringUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  ringSublabel: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSubtle,
  },
  netDiffPill: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.md,
  },
  netDiffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netDiffLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  netDiffBold: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  netDiffDelta: {
    fontSize: 12,
    fontWeight: '800',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    backgroundColor: colors.primarySurface,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    marginTop: spacing.md,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 16,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  macroCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  macroDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  macroCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    flex: 1,
  },
  macroCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  macroCardUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  macroCardTarget: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  macroCardAdherence: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  ratioCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratioHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  ratioTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  ratioSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    gap: 2,
  },
  stackedSegment: {
    height: '100%',
  },
  ratioLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  legendBold: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  chartCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  chartSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 1,
  },
  chartTargetLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dashedTargetLegend: {
    width: 14,
    height: 2,
    backgroundColor: colors.primaryLight,
    borderRadius: 1,
  },
  chartTargetLegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 175,
    paddingTop: spacing.md,
    position: 'relative',
  },
  chartTargetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    opacity: 0.6,
    zIndex: 1,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
    zIndex: 2,
  },
  barColSelected: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
  },
  barCalText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: 18,
    height: 130,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
  },
  dayLabelPill: {
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  dayLabelPillToday: {
    backgroundColor: colors.primarySurface,
  },
  barWeekday: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  barDayNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  daysListCard: {
    padding: 0,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  dayRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  dayRowSelected: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  dayRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  dayRowBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRowBadgeToday: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  dayRowWeekday: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dayRowNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 16,
  },
  dayRowInfo: {
    flex: 1,
  },
  dayRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayRowMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  dayRowMacroItem: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dayRowMacroVal: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayRowMacroDot: {
    fontSize: 10,
    color: colors.textMuted,
  },
  dayRowEmptyText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  dayRowRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  dayRowCalBtn: {
    alignItems: 'flex-end',
  },
  dayRowCalories: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dayRowCalTarget: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dayRowDelta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  dayRowQuickLog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  dayRowQuickLogText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historySubhead: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  entriesToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  entriesToggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  entriesToggleBtnActive: {
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  entriesToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  entriesToggleTextActive: {
    color: colors.primaryLight,
  },
  daysListActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  daysListActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  daysListActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
  },
}));
