import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { PressableScale } from '../ui/PressableScale';
import { useTheme } from '../../theme';
import { haptics } from '../../lib/haptics';
import { useChartLayout } from './useChartLayout';
import { CHART_FONT_FAMILY } from './chartFont';
import { niceCeil } from './chartScale';
import { useStyles } from './BarChart.styles';

export interface BarChartDatum {
  key: string;
  label: string;
  value: number;
  /** Inactive buckets (e.g. no workout that day) render as a muted stub. Defaults to true. */
  active?: boolean;
  /** Overrides the chart color for this bar, e.g. gain vs loss weeks. */
  color?: string;
  /** Extra line shown in the selection badge. */
  detail?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  color?: string;
  inactiveColor?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  /** Prefix positive values with "+" (for change/delta charts). */
  signed?: boolean;
  targetValue?: number | null;
  targetLabel?: string;
  /**
   * When true and targetValue is set, bars are colored green/amber/red based on
   * how far they deviate from the target. "under" means under-target is good
   * (cut mode), "over" means over-target is good (bulk mode), "center" means
   * close to target is good (maintenance). Defaults to false (single color).
   */
  colorByTarget?: 'under' | 'over' | 'center' | false;
  onBarPress?: (datum: BarChartDatum, index: number) => void;
  emptyState?: { icon: React.ReactNode; title: string; subtitle: string };
  accessibilityLabel?: string;
}

const AXIS_GUTTER = 44;
const VALUE_LABEL_ROOM = 16;
const MIN_LABEL_WIDTH = 58;
const LABEL_WIDTH = 52;

/**
 * Shared bar chart: zero-anchored bars (positive and negative), optional dashed
 * target line, recessive gridlines with right-hand axis labels, x labels thinned to
 * whatever fits the measured width, and tap-to-inspect selection.
 */
export function BarChart({
  data,
  height = 160,
  color,
  inactiveColor,
  unit = '',
  formatValue = (v) => `${Math.round(v)}`,
  signed = false,
  targetValue = null,
  targetLabel = 'Target',
  colorByTarget = false,
  onBarPress,
  emptyState,
  accessibilityLabel,
}: BarChartProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width, onLayout } = useChartLayout();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const barColor = color ?? colors.rose;
  const barInactiveColor = inactiveColor ?? colors.borderSubtle;

  const targetColor = useCallback(
    (value: number): string => {
      if (!colorByTarget || targetValue == null || targetValue === 0) return barColor;
      const pct = (value - targetValue) / targetValue;
      if (colorByTarget === 'under') {
        if (pct <= 0) return colors.success;
        if (pct <= 0.15) return colors.warning;
        return colors.error;
      }
      if (colorByTarget === 'over') {
        if (pct >= 0) return colors.success;
        if (pct >= -0.15) return colors.warning;
        return colors.error;
      }
      // center
      const absPct = Math.abs(pct);
      if (absPct <= 0.05) return colors.success;
      if (absPct <= 0.15) return colors.warning;
      return colors.error;
    },
    [colorByTarget, targetValue, barColor, colors.success, colors.warning, colors.error]
  );
  const fmt = (v: number) => `${signed && v > 0 ? '+' : ''}${formatValue(v)}`;

  useEffect(() => {
    if (selectedIndex == null) return;
    const timer = setTimeout(() => setSelectedIndex(null), 4000);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setSelectedIndex(null);
  }

  const domain = useMemo(() => {
    const values = data.map((d) => d.value);
    if (targetValue != null) values.push(targetValue);
    const rawMax = Math.max(0, ...values);
    const rawMin = Math.min(0, ...values);
    return {
      max: rawMax > 0 ? niceCeil(rawMax * 1.04) : 0,
      min: rawMin < 0 ? -niceCeil(-rawMin * 1.04) : 0,
    };
  }, [data, targetValue]);

  // Reserve room above/below the plot so value labels on the tallest bars never clip.
  const top = VALUE_LABEL_ROOM;
  const bottom = domain.min < 0 ? VALUE_LABEL_ROOM : 0;
  const plotH = height - top - bottom;
  const yFor = (v: number) => top + ((domain.max - v) / (domain.max - domain.min || 1)) * plotH;
  const zeroY = yFor(0);

  const plotW = Math.max(10, width - AXIS_GUTTER);
  const colW = data.length ? plotW / data.length : plotW;
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_WIDTH / colW));

  const maxAbsIndex = useMemo(() => {
    let idx = -1;
    let best = -Infinity;
    data.forEach((d, i) => {
      if (Math.abs(d.value) > best) {
        best = Math.abs(d.value);
        idx = i;
      }
    });
    return idx;
  }, [data]);

  const alwaysLabel = data.length <= 8 && colW >= 34;
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

  // Walk from the newest bar backwards so the latest label always wins a collision
  // once edge-clamping has nudged it inward.
  const xLabels: { d: BarChartDatum; left: number }[] = [];
  for (let i = data.length - 1; i >= 0; i -= labelEvery) {
    const left = Math.max(0, Math.min(plotW - LABEL_WIDTH, colW * (i + 0.5) - LABEL_WIDTH / 2));
    const prev = xLabels[xLabels.length - 1];
    if (prev && left + LABEL_WIDTH > prev.left - 2) continue;
    xLabels.push({ d: data[i], left });
  }

  const ticks = domain.min < 0 ? [domain.max, 0, domain.min] : [domain.max, domain.max / 2, 0];
  const targetY = targetValue != null ? yFor(targetValue) : null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plotArea, { height }]} onLayout={onLayout}>
        <Svg width={width} height={height} style={styles.svgLayer} pointerEvents="none">
          {ticks.map((t, i) => {
            const y = yFor(t);
            const isZero = t === 0;
            return (
              <React.Fragment key={`tick-${i}`}>
                <Line
                  x1={0}
                  x2={plotW}
                  y1={y}
                  y2={y}
                  stroke={isZero ? colors.textMuted : colors.borderSubtle}
                  strokeWidth={isZero ? 1 : 1}
                  strokeDasharray={isZero ? undefined : '3 4'}
                  opacity={isZero ? 0.45 : 0.8}
                />
                <SvgText
                  x={width - 2}
                  y={y >= height - 4 ? y - 3 : y + 3}
                  fill={colors.textMuted}
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="end"
                  fontFamily={CHART_FONT_FAMILY}
                >
                  {`${isZero ? '0' : fmt(t)}${unit}`}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        <View style={[styles.barsRow, { width: plotW }]}>
          {data.map((d, i) => {
            const isActive = d.active !== false;
            const isSelected = selectedIndex === i;
            const dimmed = selectedIndex != null && !isSelected;
            const negative = d.value < 0;
            const rawH = Math.abs(yFor(d.value) - zeroY);
            const barH = d.value === 0 || !isActive ? 3 : Math.max(3, rawH);
            const barTop = negative ? zeroY : zeroY - barH;
            const showValue = d.value !== 0 && isActive && (alwaysLabel || i === maxAbsIndex || isSelected);
            return (
              <PressableScale
                key={d.key}
                haptic="none"
                onPress={() => handlePress(d, i)}
                style={styles.barColumn}
                accessibilityLabel={`${d.label}: ${fmt(d.value)}${unit}`}
              >
                <View
                  style={[
                    styles.bar,
                    negative ? styles.barNegative : styles.barPositive,
                    {
                      top: barTop,
                      height: barH,
                      width: Math.min(28, Math.max(4, colW * 0.62)),
                      backgroundColor: isActive ? d.color ?? (colorByTarget ? targetColor(d.value) : barColor) : barInactiveColor,
                      opacity: dimmed ? 0.35 : 1,
                    },
                  ]}
                />
                {showValue && (
                  <Text
                    style={[styles.barValueLabel, { top: negative ? barTop + barH + 2 : barTop - 14 }]}
                  >
                    {fmt(d.value)}
                  </Text>
                )}
              </PressableScale>
            );
          })}
        </View>

        {/* Target sits above the bars so neither the line nor its label gets hidden behind them. */}
        {targetY != null && (
          <>
            <Svg width={plotW} height={height} style={styles.svgLayer} pointerEvents="none">
              <Line x1={0} x2={plotW} y1={targetY} y2={targetY} stroke={colors.cyan} strokeWidth={1.5} strokeDasharray="6 3" />
            </Svg>
            <View style={[styles.targetPill, { top: Math.max(0, targetY - 18) }]} pointerEvents="none">
              <Text style={styles.targetPillText}>{`${targetLabel} ${formatValue(targetValue!)}${unit}`}</Text>
            </View>
          </>
        )}

        {selected && (
          <View style={styles.selectedBadge} pointerEvents="none">
            <Text style={styles.selectedBadgeLabel}>{selected.label}</Text>
            <Text style={styles.selectedBadgeValue}>{`${fmt(selected.value)}${unit}`}</Text>
            {selected.detail ? <Text style={styles.selectedBadgeLabel}>{selected.detail}</Text> : null}
          </View>
        )}
      </View>

      <View style={[styles.labelsRow, { width: plotW }]}>
        {xLabels.map(({ d, left }) => (
          <Text key={d.key} style={[styles.barLabel, { left, width: LABEL_WIDTH }]} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
