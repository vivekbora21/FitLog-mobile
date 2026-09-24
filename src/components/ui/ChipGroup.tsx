import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, radius, spacing } from '../../theme';

interface ChipGroupProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  label?: string;
}

/** Single-select row of pill buttons. */
export function ChipGroup<T extends string | number>({ options, value, onChange, label }: ChipGroupProps<T>) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <PressableScale
              key={String(opt.value)}
              haptic="selection"
              onPress={() => onChange(opt.value)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primaryLight,
  },
});
