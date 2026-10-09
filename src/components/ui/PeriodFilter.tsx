import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { makeStyles, radius, spacing } from '../../theme';

export interface PeriodFilterOption<T extends string> {
  value: T;
  label: string;
}

interface PeriodFilterProps<T extends string> {
  options: PeriodFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'sm' for secondary/dense placements. Default 'md'. */
  size?: 'sm' | 'md';
  /** Default: true when there are more than 5 options. */
  scrollable?: boolean;
  accessibilityLabel?: string;
}

/**
 * Single generic period/segmented filter, replacing the Weight/Nutrition/Burn
 * sections' separately-implemented "1W/1M/3M…", "7D/4W/3M…" and "Day/Week/Month"
 * pill rows with one component and one visual language.
 */
export function PeriodFilter<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  scrollable,
  accessibilityLabel,
}: PeriodFilterProps<T>) {
  const styles = useStyles();
  const useScroll = scrollable ?? options.length > 5;
  const small = size === 'sm';

  const track = (
    <View
      style={[styles.track, useScroll && styles.trackScrollable]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            haptic="selection"
            onPress={() => onChange(opt.value)}
            style={[
              styles.segment,
              small && styles.segmentSm,
              useScroll && styles.segmentScrollable,
              active && (useScroll ? styles.segmentActiveScrollable : styles.segmentActive),
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Text
              style={[styles.segmentText, small && styles.segmentTextSm, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );

  if (!useScroll) return track;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller}>
      {track}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  scroller: {
    flexGrow: 0,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    padding: 3,
    gap: 2,
  },
  trackScrollable: {
    backgroundColor: 'transparent',
    padding: 0,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  segmentSm: {
    paddingVertical: 5,
  },
  segmentScrollable: {
    flex: 0,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.elevated,
  },
  segmentActiveScrollable: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  segmentTextSm: {
    fontSize: 11,
  },
  segmentTextActive: {
    color: colors.primaryLight,
  },
}));
