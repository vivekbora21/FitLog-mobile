import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import { useTheme } from '../../theme';
import { haptics } from '../../lib/haptics';
import { useStyles } from './BarChart.styles';

export interface BarChartDatum {
  key: string;
  label: string;
  value: number;
  active: boolean;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  color?: string;
  inactiveColor?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  onBarPress?: (datum: BarChartDatum, index: number) => void;
  emptyState?: { icon: React.ReactNode; title: string; subtitle: string };
  accessibilityLabel?: string;
}

const GRID_RATIOS = [0, 0.5, 1];
const AXIS_GUTTER = 40;

/**
 * Shared bar chart: reference gridlines + y-axis labels, a distinct style for
 * zero/inactive buckets, and tap-to-inspect selection. Replaces CalorieBurnSection's
 * plain, non-interactive `View` bars.
 */
export function BarChart({
  data,
  height = 160,
  color,
  inactiveColor,
  unit = '',
  formatValue = (v) => `${Math.round(v)}`,
  onBarPress,
  emptyState,
  accessibilityLabel,
}: BarChartProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const barColor = color ?? colors.rose;
  const barInactiveColor = inactiveColor ?? colors.borderSubtle;

  useEffect(() => {
    if (selectedIndex == null) return;
    const timer = setTimeout(() => setSelectedIndex(null), 4000);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const maxValue = useMemo(() => Math.max(1, ...data.map((d) => d.value)) * 1.12, [data]);
  const maxIndex = useMemo(() => {
    let idx = -1;
    let best = -Infinity;
    data.forEach((d, i) => {
      if (d.value > best) {
        best = d.value;
        idx = i;
      }
    });
    return idx;
  }, [data]);

  const alwaysLabel = data.length <= 8;
  const selected = selectedIndex != null ? data[selectedIndex] : null;

  const handlePress = (datum: BarChartDatum, index: number) => {
    haptics.selection();
    setSelectedIndex((prev) => (prev === index ? null : index));
    onBarPress?.(datum, index);
  };

  if (data.length === 0 && emptyState) {
    return (
      <View style={[styles.container, styles.emptyBox, { height }]} accessibilityLabel={accessibilityLabel}>
        {emptyState.icon}
        <Text style={styles.emptyTitle}>{emptyState.title}</Text>
        <Text style={styles.emptySubtitle}>{emptyState.subtitle}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plotArea, { height }]}>
        {GRID_RATIOS.map((ratio) => (
          <View
            key={`grid-${ratio}`}
            style={[styles.gridLine, { top: ratio * height, right: AXIS_GUTTER }]}
          />
        ))}
        {GRID_RATIOS.map((ratio) => (
          <Text
            key={`axis-${ratio}`}
            style={[styles.axisLabel, { top: Math.max(0, ratio * height - 6), width: AXIS_GUTTER - 4 }]}
          >
            {`${formatValue(maxValue * (1 - ratio))}${unit}`}
          </Text>
        ))}

        <View style={[styles.barsRow, { left: 0, right: AXIS_GUTTER, gap: 6 }]}>
          {data.map((d, i) => {
            const barHeight = d.value > 0 ? Math.max(4, (d.value / maxValue) * height) : 3;
            const isSelected = selectedIndex === i;
            const showValue = d.value > 0 && (alwaysLabel || i === maxIndex || isSelected);
            return (
              <PressableScale
                key={d.key}
                haptic="none"
                onPress={() => handlePress(d, i)}
                style={styles.barColumn}
                accessibilityLabel={`${d.label}: ${formatValue(d.value)}${unit}`}
              >
                <Text style={styles.barValueLabel} numberOfLines={1}>
                  {showValue ? formatValue(d.value) : ' '}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: d.active ? (isSelected ? colors.amber : barColor) : barInactiveColor,
                    },
                  ]}
                />
              </PressableScale>
            );
          })}
        </View>

        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeLabel}>{selected.label}</Text>
            <Text style={styles.selectedBadgeValue}>{`${formatValue(selected.value)}${unit}`}</Text>
          </View>
        )}
      </View>

      <View style={[styles.labelsRow, { paddingRight: AXIS_GUTTER, gap: 6 }]}>
        {data.map((d) => (
          <Text key={d.key} style={styles.barLabel} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
