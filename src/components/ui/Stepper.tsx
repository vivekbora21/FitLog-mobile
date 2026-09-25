import React from 'react';
import { View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { PressableScale } from './PressableScale';
import { radius, makeStyles, useTheme } from '../../theme';

interface StepperProps {
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  disabled?: boolean;
  label: string;
  accentColor?: string;
}

/** Compact − / + control for quick adjustments like water cups. */
export function Stepper({
  onDecrement,
  onIncrement,
  canDecrement = true,
  disabled = false,
  label,
  accentColor: accentColorProp,
}: StepperProps) {
  const { colors } = useTheme();
  const accentColor = accentColorProp ?? colors.primaryLight;
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <PressableScale
        haptic="selection"
        disabled={disabled || !canDecrement}
        onPress={onDecrement}
        style={[styles.btn, (disabled || !canDecrement) && styles.btnDisabled]}
        accessibilityLabel={`Remove ${label}`}
      >
        <Minus size={18} color={colors.textPrimary} />
      </PressableScale>
      <PressableScale
        haptic="light"
        disabled={disabled}
        onPress={onIncrement}
        style={[styles.btn, { backgroundColor: accentColor }, disabled && styles.btnDisabled]}
        accessibilityLabel={`Add ${label}`}
      >
        <Plus size={18} color="#FFFFFF" />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
}));
