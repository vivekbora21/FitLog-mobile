import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Moon, SkipForward } from 'lucide-react-native';
import { PressableScale } from './PressableScale';
import { Card } from './Card';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { parseDateKey, shiftDateKey, toDateKey } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { CalendarDayInfo, DayStatus } from '../../api/client';

interface WeekCalendarProps {
  selectedDate?: string;
  onSelectDate: (dateKey: string) => void;
  onOpenDayModal?: (dateKey: string) => void;
  calendarDays?: Record<string, CalendarDayInfo>;
  heatmap?: Record<string, number>;
  workoutsThisWeek?: number;
  weeklyTarget?: number;
  showAdherence?: boolean;
  title?: string;
}

export function WeekCalendar({
  selectedDate,
  onSelectDate,
  onOpenDayModal,
  calendarDays = {},
  heatmap = {},
  workoutsThisWeek,
  weeklyTarget,
  showAdherence = true,
  title = 'This week',
}: WeekCalendarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const todayKey = toDateKey(new Date());

  // Offset in weeks from current week (0 = current week, -1 = last week, etc.)
  const [weekOffset, setWeekOffset] = useState(0);

  // Compute 7 days for the active week window
  const weekDays = useMemo(() => {
    const today = new Date();
    // Start of the week: Monday
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekOffset]);

  const activeDate = selectedDate || todayKey;

  const weekRangeLabel = useMemo(() => {
    if (weekOffset === 0) return title;
    const first = weekDays[0];
    const last = weekDays[6];
    const m1 = first.toLocaleDateString('en-US', { month: 'short' });
    const m2 = last.toLocaleDateString('en-US', { month: 'short' });
    if (m1 === m2) {
      return `${m1} ${first.getDate()} – ${last.getDate()}`;
    }
    return `${m1} ${first.getDate()} – ${m2} ${last.getDate()}`;
  }, [weekOffset, weekDays, title]);

  const handlePrevWeek = () => {
    haptics.selection();
    setWeekOffset((w) => w - 1);
  };

  const handleNextWeek = () => {
    haptics.selection();
    setWeekOffset((w) => w + 1);
  };

  const handleDayPress = (key: string) => {
    haptics.selection();
    onSelectDate(key);
    if (onOpenDayModal) {
      onOpenDayModal(key);
    }
  };

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.weekTitle}>{weekRangeLabel}</Text>
          {showAdherence && workoutsThisWeek !== undefined && weeklyTarget !== undefined && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                <Text style={styles.countStrong}>{workoutsThisWeek}</Text>/{weeklyTarget} workouts
              </Text>
            </View>
          )}
        </View>

        <View style={styles.navRow}>
          <PressableScale
            haptic="selection"
            onPress={handlePrevWeek}
            style={styles.navArrow}
            accessibilityLabel="Previous week"
          >
            <ChevronLeft size={18} color={colors.textSecondary} />
          </PressableScale>
          {weekOffset !== 0 && (
            <PressableScale
              haptic="selection"
              onPress={() => setWeekOffset(0)}
              style={styles.todayJumpBtn}
              accessibilityLabel="Jump to this week"
            >
              <Text style={styles.todayJumpText}>Today</Text>
            </PressableScale>
          )}
          <PressableScale
            haptic="selection"
            onPress={handleNextWeek}
            style={styles.navArrow}
            accessibilityLabel="Next week"
          >
            <ChevronRight size={18} color={colors.textSecondary} />
          </PressableScale>
        </View>
      </View>

      {/* Week Day Columns */}
      <View style={styles.weekRow}>
        {weekDays.map((d) => {
          const key = toDateKey(d);
          const isToday = key === todayKey;
          const isSelected = key === activeDate;

          const info = calendarDays[key];
          let status: DayStatus = info?.status || 'UPCOMING';
          // Fallback to heatmap if calendarDays didn't mark it
          if (status === 'UPCOMING' && (heatmap[key] || 0) > 0) {
            status = 'COMPLETED';
          }

          const isCompleted = status === 'COMPLETED';
          const isRest = status === 'REST';
          const isSkipped = status === 'SKIPPED';

          const dayLetter = d.toLocaleDateString('en-US', { weekday: 'narrow' });
          const dayNumber = d.getDate();

          return (
            <PressableScale
              key={key}
              haptic="selection"
              onPress={() => handleDayPress(key)}
              style={[
                styles.dayCol,
                isSelected && styles.dayColSelected,
                isToday && !isSelected && styles.dayColToday,
              ]}
              accessibilityLabel={`${d.toLocaleDateString('en-US', { weekday: 'long' })}, ${dayNumber}: ${status.toLowerCase()}`}
              accessibilityHint="Tap to view or change day status"
            >
              <Text style={[styles.dayLabel, (isToday || isSelected) && styles.dayLabelStrong]}>
                {dayLetter}
              </Text>

              <View
                style={[
                  styles.dayDot,
                  isCompleted && styles.dayDotCompleted,
                  isRest && styles.dayDotRest,
                  isSkipped && styles.dayDotSkipped,
                  isToday && !isCompleted && !isRest && !isSkipped && styles.dayDotTodayEmpty,
                  isSelected && styles.dayDotSelected,
                ]}
              >
                {isCompleted ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : isRest ? (
                  <Moon size={14} color={colors.cyan} strokeWidth={2.6} />
                ) : isSkipped ? (
                  <SkipForward size={13} color={colors.amber} strokeWidth={2.4} />
                ) : (
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && styles.dayNumToday,
                      isSelected && styles.dayNumSelected,
                    ]}
                  >
                    {dayNumber}
                  </Text>
                )}
              </View>

              {info?.program_day ? (
                <Text style={[styles.programDayTag, isSelected && styles.programDayTagSelected]}>
                  D{info.program_day.day_number}
                </Text>
              ) : isToday ? (
                <View style={styles.todayIndicatorDot} />
              ) : null}
            </PressableScale>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]}>
            <Check size={9} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text style={styles.legendText}>Done</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(2, 132, 199, 0.2)' }]}>
            <Moon size={9} color={colors.cyan} strokeWidth={2.6} />
          </View>
          <Text style={styles.legendText}>Rest</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(217, 119, 6, 0.2)' }]}>
            <SkipForward size={9} color={colors.amber} strokeWidth={2.4} />
          </View>
          <Text style={styles.legendText}>Skipped</Text>
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
  },
  countText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  countStrong: {
    fontWeight: '800',
    color: colors.primaryLight,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navArrow: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayJumpBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayJumpText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: 6,
  },
  dayColSelected: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  dayColToday: {
    backgroundColor: colors.canvas,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dayLabelStrong: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayDotCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  dayDotRest: {
    backgroundColor: 'rgba(2, 132, 199, 0.16)',
    borderColor: 'rgba(2, 132, 199, 0.35)',
  },
  dayDotSkipped: {
    backgroundColor: 'rgba(217, 119, 6, 0.16)',
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  dayDotTodayEmpty: {
    borderColor: colors.primaryLight,
    borderWidth: 1.5,
    backgroundColor: colors.primarySurface,
  },
  dayDotSelected: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayNumToday: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  dayNumSelected: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    marginTop: -2,
  },
  programDayTag: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryLight,
    marginTop: -2,
  },
  programDayTagSelected: {
    color: colors.textPrimary,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
}));
