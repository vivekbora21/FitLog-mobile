import React from 'react';
import { Text, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { haptics } from '../../lib/haptics';

interface SnapStatusButtonProps {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  activeColor?: string;
  activeBackground?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  flex?: number;
  accessibilityLabel?: string;
}

export function SnapStatusButton({
  icon,
  label,
  active,
  activeColor: activeColorProp,
  activeBackground: activeBackgroundProp,
  onPress,
  disabled,
  style,
  flex = 1,
  accessibilityLabel,
}: SnapStatusButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bounce = useSharedValue(1);

  const activeColor = activeColorProp ?? colors.primaryLight;
  const activeBackground = activeBackgroundProp ?? `${activeColor}18`;

  const handlePress = () => {
    haptics.medium();
    bounce.set(
      withSequence(
        withTiming(0.88, { duration: 80 }),
        withSpring(1.12, { damping: 8, stiffness: 350 }),
        withSpring(1, { damping: 12, stiffness: 250 })
      )
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }],
  }));

  return (
    <Animated.View style={[{ flex }, animatedStyle]}>
      <PressableScale
        haptic="none"
        onPress={handlePress}
        disabled={disabled}
        scaleTo={0.96}
        style={[
          styles.btn,
          active && {
            backgroundColor: activeBackground,
            borderColor: activeColor,
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected: active }}
      >
        {icon}
        {label ? (
          <Text
            style={[
              styles.btnText,
              active && { color: activeColor, fontWeight: '800' },
            ]}
          >
            {label}
          </Text>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 38,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
}));
