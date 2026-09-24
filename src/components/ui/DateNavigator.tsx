import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PressableScale } from './PressableScale';
import { colors, radius, spacing } from '../../theme';
import { formatDayLabel, parseDateKey, shiftDateKey, toDateKey } from '../../lib/format';

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

/** Previous / next day stepper. Future days are blocked since nothing can be logged there yet. */
export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const todayKey = toDateKey(new Date());
  const isToday = date >= todayKey;
  const label = formatDayLabel(date);
  const fullDate = parseDateKey(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.row}>
      <PressableScale
        haptic="selection"
        onPress={() => onChange(shiftDateKey(date, -1))}
        style={styles.arrow}
        accessibilityLabel="Previous day"
      >
        <ChevronLeft size={20} color={colors.textPrimary} />
      </PressableScale>

      <PressableScale
        haptic="selection"
        disabled={isToday}
        onPress={() => onChange(todayKey)}
        style={styles.center}
        accessibilityLabel={isToday ? fullDate : `${fullDate}. Jump to today`}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{isToday ? fullDate : 'Tap to jump to today'}</Text>
      </PressableScale>

      <PressableScale
        haptic="selection"
        disabled={isToday}
        onPress={() => onChange(shiftDateKey(date, 1))}
        style={[styles.arrow, isToday && styles.arrowDisabled]}
        accessibilityLabel="Next day"
      >
        <ChevronRight size={20} color={isToday ? colors.textMuted : colors.textPrimary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sub: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
});
