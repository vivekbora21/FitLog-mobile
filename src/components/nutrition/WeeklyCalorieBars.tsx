import React from 'react';
import { View, Text } from 'react-native';
import { Card, PressableScale } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { formatNumber } from '../../types';
import type { WeeklyNutritionDayItem } from '../../types';
import { haptics } from '../../lib/haptics';

interface WeeklyCalorieBarsProps {
  days: WeeklyNutritionDayItem[];
  targetCalories: number;
  selectedDate?: string;
  isCut: boolean;
  isBulk: boolean;
  onSelectDate: (dateKey: string) => void;
}

const BAR_MAX_HEIGHT = 112;

/**
 * Compact 7-day calorie-vs-target column chart, extracted from WeeklyNutritionProgress
 * so the weekly view reads at a glance before anyone drills into the full day list.
 * Pure presentation over values already computed by `computeWeeklyNutritionSummaries`.
 */
export function WeeklyCalorieBars({
  days,
  targetCalories,
  selectedDate,
  isCut,
  isBulk,
  onSelectDate,
}: WeeklyCalorieBarsProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  const maxDayCalories = Math.max(targetCalories * 1.25, ...days.map((d) => d.total_calories), 2400);
  const targetLineBottom = Math.min(
    BAR_MAX_HEIGHT,
    Math.max(16, (targetCalories / maxDayCalories) * BAR_MAX_HEIGHT)
  ) + 26;

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>7-Day Calorie Breakdown</Text>
          <Text style={styles.chartSubtitle}>Tap a day to inspect or log meals</Text>
        </View>
        <View style={styles.chartTargetLegend}>
          <View style={styles.dashedTargetLegend} />
          <Text style={styles.chartTargetLegendText}>Target {formatNumber(targetCalories)}</Text>
        </View>
      </View>

      <View style={styles.barsContainer}>
        <View style={[styles.chartTargetLine, { bottom: targetLineBottom }]} />

        {days.map((dayItem) => {
          const isSelected = dayItem.date === selectedDate;
          const hasLogged = dayItem.has_logged;
          const cal = dayItem.total_calories;
          const barHeight = hasLogged
            ? Math.min(BAR_MAX_HEIGHT, Math.max(8, (cal / maxDayCalories) * BAR_MAX_HEIGHT))
            : 4;

          let barColor = colors.primaryLight;
          if (!hasLogged) {
            barColor = colors.track;
          } else if (isCut) {
            barColor = cal <= targetCalories ? colors.primaryLight : colors.warning;
          } else if (isBulk) {
            barColor = cal >= targetCalories ? colors.success : colors.amber;
          }

          return (
            <PressableScale
              key={dayItem.date}
              haptic="selection"
              onPress={() => {
                haptics.selection();
                onSelectDate(dayItem.date);
              }}
              style={[styles.barCol, isSelected && styles.barColSelected]}
              accessibilityLabel={`${dayItem.weekday}, ${dayItem.date}: ${cal} calories. ${hasLogged ? 'Logged' : 'No entries'}`}
            >
              <Text style={[styles.barCalText, isSelected && styles.barCalTextSelected]}>
                {hasLogged ? (cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : cal) : '–'}
              </Text>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: barHeight, backgroundColor: barColor }]} />
              </View>

              <View style={[styles.dayLabelPill, dayItem.is_today && styles.dayLabelPillToday]}>
                <Text
                  style={[
                    styles.barWeekday,
                    dayItem.is_today && styles.barLabelToday,
                    isSelected && styles.barLabelSelected,
                  ]}
                >
                  {dayItem.weekday.charAt(0)}
                </Text>
                <Text
                  style={[
                    styles.barDayNumber,
                    dayItem.is_today && styles.barLabelToday,
                    isSelected && styles.barLabelSelected,
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
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
    height: BAR_MAX_HEIGHT + 44,
    paddingTop: spacing.sm,
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
    opacity: 0.5,
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
  barCalTextSelected: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  barTrack: {
    width: 16,
    height: BAR_MAX_HEIGHT,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
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
  barLabelToday: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  barLabelSelected: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
}));
