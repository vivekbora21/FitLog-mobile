import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { makeStyles, spacing, useTheme } from '../../theme';

export interface HBarDatum {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  color?: string;
}

export interface HBarChartProps {
  data: HBarDatum[];
  color?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  /** Prefix positive values with "+" (for change/delta charts). */
  signed?: boolean;
  accessibilityLabel?: string;
}

/**
 * Horizontal bars for ranked or categorical data where labels are too long to sit
 * under vertical bars. When any value is negative the bars diverge from a centre
 * zero line, which makes "change since start" style comparisons read directly.
 */
export function HBarChart({
  data,
  color,
  unit = '',
  formatValue = (v) => `${Math.round(v * 10) / 10}`,
  signed = false,
  accessibilityLabel,
}: HBarChartProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const diverging = data.some((d) => d.value < 0);
  const maxAbs = useMemo(() => Math.max(1e-6, ...data.map((d) => Math.abs(d.value))), [data]);
  const fmt = (v: number) => `${signed && v > 0 ? '+' : ''}${formatValue(v)}${unit}`;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel}>
      {data.map((d) => {
        const pct = (Math.abs(d.value) / maxAbs) * (diverging ? 50 : 100);
        const barStyle = diverging
          ? d.value >= 0
            ? { left: '50%' as const, width: `${pct}%` as const }
            : { right: '50%' as const, width: `${pct}%` as const }
          : { left: 0, width: `${pct}%` as const };
        const rounded = diverging && d.value < 0 ? styles.barRoundLeft : styles.barRoundRight;
        return (
          <View key={d.key} style={styles.row} accessibilityLabel={`${d.label}: ${fmt(d.value)}`}>
            <View style={styles.labelCol}>
              <Text style={styles.label} numberOfLines={1}>
                {d.label}
              </Text>
              {d.sublabel ? (
                <Text style={styles.sublabel} numberOfLines={1}>
                  {d.sublabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.track}>
              {diverging && <View style={styles.zeroLine} />}
              <View
                style={[
                  styles.bar,
                  rounded,
                  barStyle,
                  { minWidth: d.value === 0 ? 0 : 3, backgroundColor: d.color ?? color ?? colors.primaryLight },
                ]}
              />
            </View>
            <Text style={styles.value} numberOfLines={1}>
              {fmt(d.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  labelCol: {
    width: '40%',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sublabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  track: {
    flex: 1,
    height: 12,
    justifyContent: 'center',
  },
  zeroLine: {
    position: 'absolute',
    left: '50%',
    top: -4,
    bottom: -4,
    width: 1,
    backgroundColor: colors.textMuted,
    opacity: 0.45,
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  barRoundRight: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  barRoundLeft: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  value: {
    width: 64,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
}));
