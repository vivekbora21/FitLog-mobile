import React, { useEffect, useId } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface ArcGaugeProps {
  /** Percentage from 0 to 100+ (values >= 100 fill the entire arc) */
  percentage: number;
  /** Width / bounding size of the gauge circle (default: 180) */
  size?: number;
  /** Thickness of the progress stroke (default: 13) */
  strokeWidth?: number;
  /** Total angle of the arc in degrees, centered at 12 o'clock (default: 220) */
  arcAngle?: number;
  /** Primary stroke color */
  color?: string;
  /** Optional second color to create a linear gradient along the arc */
  gradientTo?: string;
  /** Track background color */
  trackColor?: string;
  /** Delay in milliseconds before animating */
  delay?: number;
  /** Whether to show a subtle inner precision guide arc */
  showInnerGuide?: boolean;
  /** Content rendered inside the center of the arc */
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function ArcGauge({
  percentage,
  size = 180,
  strokeWidth = 13,
  arcAngle = 220,
  color: colorProp,
  gradientTo,
  trackColor: trackColorProp,
  delay = 0,
  showInnerGuide = true,
  children,
  style,
}: ArcGaugeProps) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.primaryLight;
  const trackColor = trackColorProp ?? colors.track;

  const gradientId = `arc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;

  // Arc angles (0deg = 3 o'clock, 90deg = 6 o'clock, 180deg = 9 o'clock, 270deg = 12 o'clock)
  const halfArc = arcAngle / 2;
  const startDeg = 270 - halfArc;
  const endDeg = 270 + halfArc;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startRad = toRad(startDeg);
  const endRad = toRad(endDeg);

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const largeArcFlag = arcAngle > 180 ? 1 : 0;
  const arcPath = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  const arcLength = (arcAngle / 360) * 2 * Math.PI * r;

  // Inner precision guide arc
  const rInner = Math.max(10, r - strokeWidth - 6);
  const x1Inner = cx + rInner * Math.cos(startRad);
  const y1Inner = cy + rInner * Math.sin(startRad);
  const x2Inner = cx + rInner * Math.cos(endRad);
  const y2Inner = cy + rInner * Math.sin(endRad);
  const innerArcPath = `M ${x1Inner.toFixed(2)} ${y1Inner.toFixed(2)} A ${rInner.toFixed(2)} ${rInner.toFixed(2)} 0 ${largeArcFlag} 1 ${x2Inner.toFixed(2)} ${y2Inner.toFixed(2)}`;

  // SVG height: calculate bottom extent of the arc
  const bottomExtent = Math.max(y1, y2) + strokeWidth / 2 + 4;
  const svgHeight = Math.ceil(Math.max(size * 0.76, bottomExtent));

  // Clamped target progress between 0 and 1
  const target = Math.min(100, Math.max(0, percentage || 0)) / 100;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        delay,
        withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) })
      )
    );
  }, [target, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - progress.value),
    strokeOpacity: progress.value > 0.005 ? 1 : 0,
  }));

  return (
    <View style={[{ width: size, height: svgHeight, alignItems: 'center' }, style]}>
      <Svg width={size} height={svgHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          {gradientTo ? (
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={gradientTo} />
            </LinearGradient>
          ) : null}
        </Defs>

        {/* Inner subtle guide arc */}
        {showInnerGuide && (
          <Path
            d={innerArcPath}
            stroke={colors.borderSubtle}
            strokeWidth={1}
            strokeDasharray="3 5"
            strokeLinecap="round"
            fill="none"
            opacity={0.55}
          />
        )}

        {/* Base Track Arc */}
        <Path
          d={arcPath}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {/* Animated Progress Arc */}
        <AnimatedPath
          d={arcPath}
          stroke={gradientTo ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength.toFixed(2)} ${arcLength.toFixed(2)}`}
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>

      {/* Center content */}
      {children && (
        <View style={[styles.centerContainer, { top: strokeWidth + 4, bottom: 4 }]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
});
