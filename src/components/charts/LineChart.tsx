import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Calendar } from 'lucide-react-native';
import { PressableScale } from '../ui/PressableScale';
import { useTheme } from '../../theme';
import { haptics } from '../../lib/haptics';
import { useChartLayout } from './useChartLayout';
import { buildEvenLabels, computeNiceDomain, scaleLinear } from './chartScale';
import { useStyles } from './LineChart.styles';

export interface LineChartPoint {
  value: number;
  date: string;
  trendValue?: number;
}

export type LineChartMode = 'raw' | 'trend' | 'both';

export interface LineChartProps {
  data: LineChartPoint[];
  height?: number;
  color?: string;
  mode?: LineChartMode;
  onModeChange?: (mode: LineChartMode) => void;
  targetValue?: number | null;
  targetLabel?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  showPoints?: 'auto' | 'always' | 'never';
  emptyState?: { icon: React.ReactNode; title: string; subtitle: string };
  renderTooltipExtra?: (point: LineChartPoint) => React.ReactNode;
  accessibilityLabel?: string;
}

const MODE_OPTIONS: { key: LineChartMode; label: string }[] = [
  { key: 'both', label: 'Both' },
  { key: 'trend', label: 'Trend' },
  { key: 'raw', label: 'Raw' },
];

/**
 * Shared SVG line/trend chart: gradient fill, optional smoothed-trend overlay,
 * optional target line, scrub-to-inspect gesture with a floating tooltip, and
 * standardized gridlines/axis labels. Replaces the Weight and Nutrition sections'
 * separately hand-rolled chart implementations.
 */
export function LineChart({
  data,
  height = 195,
  color,
  mode: modeProp,
  onModeChange,
  targetValue = null,
  targetLabel = 'Target',
  unit = '',
  formatValue = (v) => `${Math.round(v * 10) / 10}`,
  showPoints = 'auto',
  emptyState,
  renderTooltipExtra,
  accessibilityLabel,
}: LineChartProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width: layoutWidth, onLayout } = useChartLayout();
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const gradientId = `lineChartGrad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const lineColor = color ?? colors.primaryLight;
  const targetColor = colors.cyan;
  const withUnit = useCallback((v: number) => `${formatValue(v)}${unit ? ` ${unit}` : ''}`, [formatValue, unit]);
  const withUnitCompact = useCallback((v: number) => `${formatValue(v)}${unit}`, [formatValue, unit]);
  const hasTrend = data.some((d) => d.trendValue != null);
  const mode: LineChartMode = hasTrend ? modeProp ?? 'both' : 'raw';
  const showModeSwitcher = hasTrend && !!onModeChange;

  const chartHeight = height;
  const paddingLeft = 6;
  const paddingRight = 40;
  const paddingTop = 22;
  const paddingBottom = 28;
  const innerW = Math.max(10, layoutWidth - paddingLeft - paddingRight);
  const innerH = chartHeight - paddingTop - paddingBottom;

  useEffect(() => {
    if (scrubIndex == null) return;
    const timer = setTimeout(() => setScrubIndex(null), 4500);
    return () => clearTimeout(timer);
  }, [scrubIndex]);

  const domain = useMemo(() => {
    const values: number[] = [];
    data.forEach((d) => {
      values.push(d.value);
      if (d.trendValue != null) values.push(d.trendValue);
    });
    if (targetValue != null) values.push(targetValue);
    return computeNiceDomain(values);
  }, [data, targetValue]);

  const yScale = useMemo(
    () => scaleLinear(domain, { min: chartHeight - paddingBottom, max: paddingTop }),
    [domain, chartHeight, paddingBottom, paddingTop]
  );

  const xFor = useCallback(
    (i: number) => paddingLeft + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    [data.length, innerW, paddingLeft]
  );

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: xFor(i),
        rawY: yScale(d.value),
        trendY: d.trendValue != null ? yScale(d.trendValue) : yScale(d.value),
        value: d.value,
        trendValue: d.trendValue,
        date: d.date,
      })),
    [data, xFor, yScale]
  );

  const rawLinePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.rawY}` : `${acc} L ${pt.x},${pt.rawY}`), '');
  }, [points]);

  const trendLinePath = useMemo(() => {
    if (points.length < 2 || !hasTrend) return '';
    return points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.trendY}` : `${acc} L ${pt.x},${pt.trendY}`), '');
  }, [points, hasTrend]);

  const primaryLinePath = hasTrend ? trendLinePath : rawLinePath;
  const areaPath = useMemo(() => {
    if (points.length < 2 || primaryLinePath === '') return '';
    const bottom = chartHeight - paddingBottom;
    return `${primaryLinePath} L ${points[points.length - 1].x},${bottom} L ${points[0].x},${bottom} Z`;
  }, [primaryLinePath, points, chartHeight, paddingBottom]);

  const targetY = targetValue != null ? yScale(targetValue) : null;

  const onScrub = useCallback(
    (touchX: number) => {
      if (points.length === 0) return;
      let closestIdx = 0;
      let closestDist = Math.abs(points[0].x - touchX);
      for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(points[i].x - touchX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      setScrubIndex((prev) => {
        if (prev !== closestIdx) haptics.selection();
        return closestIdx;
      });
    },
    [points]
  );

  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => {
        'worklet';
        runOnJS(onScrub)(e.x);
      })
      .onUpdate((e) => {
        'worklet';
        runOnJS(onScrub)(e.x);
      });
    const tap = Gesture.Tap().onEnd((e) => {
      'worklet';
      runOnJS(onScrub)(e.x);
    });
    return Gesture.Race(pan, tap);
  }, [onScrub]);

  const activePoint = scrubIndex != null ? points[scrubIndex] : null;
  const activeDataPoint = scrubIndex != null ? data[scrubIndex] : null;

  const showDots = showPoints === 'always' || (showPoints === 'auto' && data.length <= 14);

  const axisLabels = useMemo(
    () => buildEvenLabels(data, (d) => d.date.slice(5)),
    [data]
  );

  const gridRatios = [0, 0.5, 1];

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.container} accessibilityLabel={accessibilityLabel}>
      {showModeSwitcher && (
        <View style={styles.header}>
          <View style={styles.modeSwitcher}>
            {MODE_OPTIONS.map((opt) => (
              <PressableScale
                key={opt.key}
                haptic="selection"
                onPress={() => onModeChange?.(opt.key)}
                style={[styles.modeBtn, mode === opt.key && styles.modeBtnActive]}
                accessibilityLabel={`Show ${opt.label.toLowerCase()}`}
              >
                <Text style={[styles.modeBtnText, mode === opt.key && styles.modeBtnTextActive]}>{opt.label}</Text>
              </PressableScale>
            ))}
          </View>
        </View>
      )}

      {points.length > 0 && (
        <View style={styles.legendRow}>
          {hasTrend && (mode === 'raw' || mode === 'both') && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: lineColor }]} />
              <Text style={styles.legendText}>Actual</Text>
            </View>
          )}
          {hasTrend && (mode === 'trend' || mode === 'both') && (
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: lineColor }]} />
              <Text style={styles.legendText}>Trend</Text>
            </View>
          )}
          {targetValue != null && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDashed, { borderColor: targetColor }]} />
              <Text style={styles.legendText}>{targetLabel}</Text>
            </View>
          )}
        </View>
      )}

      {points.length > 0 && (
        <Text style={styles.scrubHint} numberOfLines={1}>
          {points.length === 1 ? 'Tap the point to inspect details' : 'Tap & drag to inspect a point'}
        </Text>
      )}

      <GestureDetector gesture={composedGesture}>
        <View onLayout={onLayout} style={[styles.chartWrap, { width: '100%', height: chartHeight }]}>
          <Svg width={layoutWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Recessive reference gridlines, each labeled on the right so the scale reads without scrubbing */}
            {gridRatios.map((ratio) => {
              const y = paddingTop + ratio * innerH;
              const value = domain.max - ratio * (domain.max - domain.min);
              return (
                <React.Fragment key={`grid-${ratio}`}>
                  <Line
                    x1={paddingLeft}
                    y1={y}
                    x2={layoutWidth - paddingRight}
                    y2={y}
                    stroke={colors.borderSubtle}
                    strokeDasharray="4 4"
                    opacity={0.6}
                  />
                  {points.length > 0 && (
                    <SvgText
                      x={layoutWidth - paddingRight + 4}
                      y={y + 3}
                      fill={colors.textMuted}
                      fontSize="9"
                    >
                      {withUnitCompact(value)}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}

            {/* Target line, always labeled so it reads correctly without scrubbing */}
            {targetY != null && (
              <>
                <Line
                  x1={paddingLeft}
                  y1={targetY}
                  x2={layoutWidth - paddingRight}
                  y2={targetY}
                  stroke={targetColor}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
                <SvgText x={paddingLeft + 2} y={targetY - 5} fill={targetColor} fontSize="9" fontWeight="700">
                  {`${targetLabel} ${withUnit(targetValue!)}`}
                </SvgText>
              </>
            )}

            {/* Single-point horizontal reference line */}
            {points.length === 1 && (
              <Line
                x1={paddingLeft}
                y1={points[0].rawY}
                x2={layoutWidth - paddingRight}
                y2={points[0].rawY}
                stroke={lineColor}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                opacity={0.35}
              />
            )}

            {/* Area fill under the primary (trend if present, else raw) line */}
            {areaPath !== '' && <Path d={areaPath} fill={`url(#${gradientId})`} />}

            {/* Secondary raw line, shown faint behind the trend line in 'both' mode */}
            {rawLinePath !== '' && hasTrend && (mode === 'raw' || mode === 'both') && (
              <Path
                d={rawLinePath}
                fill="none"
                stroke={mode === 'both' ? colors.borderGlow : lineColor}
                strokeWidth={mode === 'both' ? 1.5 : 2.5}
                strokeDasharray={mode === 'both' ? '4 3' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={mode === 'both' ? 0.6 : 1}
              />
            )}

            {/* Single-series raw line when there's no trend overlay at all */}
            {rawLinePath !== '' && !hasTrend && (
              <Path d={rawLinePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Primary trend line */}
            {trendLinePath !== '' && (mode === 'trend' || mode === 'both') && (
              <Path d={trendLinePath} fill="none" stroke={lineColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Single point presentation */}
            {points.length === 1 && (
              <>
                <Circle cx={points[0].x} cy={points[0].rawY} r={12} fill={lineColor} fillOpacity={0.2} />
                <Circle
                  cx={points[0].x}
                  cy={points[0].rawY}
                  r={scrubIndex === 0 ? 6.5 : 5}
                  fill={scrubIndex === 0 ? colors.amber : lineColor}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <SvgText x={points[0].x} y={points[0].rawY - 14} textAnchor="middle" fill={lineColor} fontSize="12" fontWeight="800">
                  {withUnit(points[0].value)}
                </SvgText>
              </>
            )}

            {/* Data point dots — suppressed above ~14 points to keep longer ranges readable */}
            {points.length > 1 &&
              showDots &&
              (mode === 'raw' || mode === 'both') &&
              points.map((pt, i) => (
                <Circle
                  key={`raw-${i}`}
                  cx={pt.x}
                  cy={pt.rawY}
                  r={scrubIndex === i ? 5.5 : 3.5}
                  fill={scrubIndex === i ? colors.amber : colors.surface}
                  stroke={scrubIndex === i ? '#FFFFFF' : mode === 'both' ? colors.textMuted : lineColor}
                  strokeWidth={1.5}
                />
              ))}

            {points.length > 1 && showDots && mode === 'trend' && hasTrend &&
              points.map((pt, i) => (
                <Circle
                  key={`trend-${i}`}
                  cx={pt.x}
                  cy={pt.trendY}
                  r={scrubIndex === i ? 6 : 4}
                  fill={scrubIndex === i ? lineColor : colors.surface}
                  stroke={lineColor}
                  strokeWidth={2}
                />
              ))}

            {/* Active scrub cursor + markers */}
            {activePoint && points.length > 1 && (
              <>
                <Line
                  x1={activePoint.x}
                  y1={paddingTop - 6}
                  x2={activePoint.x}
                  y2={chartHeight - paddingBottom}
                  stroke={lineColor}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
                <Circle cx={activePoint.x} cy={activePoint.trendY} r={12} fill={lineColor} fillOpacity={0.22} />
                <Circle cx={activePoint.x} cy={activePoint.trendY} r={5.5} fill={lineColor} stroke="#FFFFFF" strokeWidth={2} />
                {hasTrend && mode === 'both' && (
                  <>
                    <Circle cx={activePoint.x} cy={activePoint.rawY} r={9} fill={colors.amber} fillOpacity={0.25} />
                    <Circle cx={activePoint.x} cy={activePoint.rawY} r={4.5} fill={colors.amber} stroke="#FFFFFF" strokeWidth={1.8} />
                  </>
                )}
              </>
            )}

            {/* X-axis date labels, evenly spaced */}
            {axisLabels.map(({ index, label }, i) => (
              <SvgText
                key={`axis-${index}`}
                x={xFor(index)}
                y={chartHeight - 10}
                fill={colors.textMuted}
                fontSize="10"
                fontWeight="600"
                textAnchor={i === 0 ? 'start' : i === axisLabels.length - 1 ? 'end' : 'middle'}
              >
                {label}
              </SvgText>
            ))}
          </Svg>

          {points.length === 0 && emptyState && (
            <View style={styles.emptyOverlay} pointerEvents="none">
              {emptyState.icon}
              <Text style={styles.emptyTitle}>{emptyState.title}</Text>
              <Text style={styles.emptySubtitle}>{emptyState.subtitle}</Text>
            </View>
          )}

          {activePoint && activeDataPoint && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={[styles.tooltip, { left: Math.max(8, Math.min(layoutWidth - 170, activePoint.x - 80)) }]}
              pointerEvents="none"
            >
              <View style={styles.tooltipHeader}>
                <Calendar size={11} color={lineColor} />
                <Text style={styles.tooltipDate}>{activePoint.date}</Text>
              </View>

              {(mode === 'raw' || mode === 'both' || !hasTrend) && (
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>{hasTrend ? 'Actual' : 'Value'}</Text>
                  <Text style={styles.tooltipValue}>{withUnit(activePoint.value)}</Text>
                </View>
              )}

              {hasTrend && (mode === 'trend' || mode === 'both') && (
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>Trend</Text>
                  <Text style={styles.tooltipValue}>{withUnit(activePoint.trendValue ?? activePoint.value)}</Text>
                </View>
              )}

              {targetValue != null && (
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipLabel}>{targetLabel}</Text>
                  <Text style={[styles.tooltipValue, activePoint.value <= targetValue ? styles.tooltipPositive : styles.tooltipNegative]}>
                    {`${withUnit(Math.abs(activePoint.value - targetValue))} ${activePoint.value <= targetValue ? 'under' : 'over'}`}
                  </Text>
                </View>
              )}

              {renderTooltipExtra?.(activeDataPoint)}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
