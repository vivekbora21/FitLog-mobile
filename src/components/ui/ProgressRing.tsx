import React, { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { makeStyles, useTheme } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0–100 */
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Optional second color to sweep a gradient along the arc. */
  gradientTo?: string;
  trackColor?: string;
  delay?: number;
  children?: React.ReactNode;
}

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
  color: colorProp,
  gradientTo,
  trackColor: trackColorProp,
  delay = 0,
  children,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.primaryLight;
  const trackColor = trackColorProp ?? colors.track;
  const styles = useStyles();
  // useId() yields ":r0:"-style ids; SVG url(#…) references need plain characters.
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(100, Math.max(0, percentage || 0)) / 100;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(
      delay,
      withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) })
    ));
  }, [target, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    // A round linecap renders a dot at 0%, so hide the arc until it has length.
    strokeOpacity: progress.value > 0.005 ? 1 : 0,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.svg}>
        {gradientTo && (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="1" stopColor={gradientTo} />
            </LinearGradient>
          </Defs>
        )}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={gradientTo ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
      {children && <View style={styles.center}>{children}</View>}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  svg: {
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
