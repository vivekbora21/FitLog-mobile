import React from 'react';
import { View, Text } from 'react-native';
import { Ruler, Scale, User } from 'lucide-react-native';
import { ChipGroup, Input, PressableScale } from '../ui';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { parseNumberInput } from '../../lib/format';
import type { JourneyMode } from '../../types';
import {
  DAYS_PER_WEEK_OPTIONS,
  DURATION_PRESETS,
  MAX_PLAN_DAYS,
  MIN_PLAN_DAYS,
  SEX_OPTIONS,
  WEEKDAY_OPTIONS,
} from './constants';
import type { WizardDetails } from './types';

interface DetailsStepProps {
  mode: JourneyMode | null;
  details: WizardDetails;
  onChange: (patch: Partial<WizardDetails>) => void;
  errorMessage?: string | null;
}

/** Step 2: duration, schedule, body stats. One screen, no fetch. */
export function DetailsStep({ mode, details, onChange, errorMessage }: DetailsStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  const durationNum = parseNumberInput(details.duration);

  const toggleWeekday = (day: number) => {
    const has = details.weekdays.includes(day);
    if (has) {
      onChange({ weekdays: details.weekdays.filter((d) => d !== day) });
    } else {
      onChange({ weekdays: [...details.weekdays, day].sort((a, b) => a - b) });
    }
  };

  const onDaysPerWeekChange = (n: number) => {
    // Keep the lowest-numbered weekdays selected by default when the count changes.
    const weekdays = WEEKDAY_OPTIONS.slice(0, n).map((w) => w.value);
    onChange({ daysPerWeek: n, weekdays });
  };

  return (
    <View>
      <Text style={styles.heading}>Set the details</Text>
      <Text style={styles.body}>Duration, weekly schedule and your current stats.</Text>

      <Text style={styles.label}>Plan length</Text>
      <ChipGroup
        options={DURATION_PRESETS}
        value={durationNum && DURATION_PRESETS.some((d) => d.value === durationNum) ? durationNum : null}
        onChange={(d) => onChange({ duration: String(d) })}
      />
      <Input
        label={`Custom length (${MIN_PLAN_DAYS}–${MAX_PLAN_DAYS} days)`}
        keyboardType="number-pad"
        value={details.duration}
        onChangeText={(v) => onChange({ duration: v })}
      />

      <ChipGroup
        label="Workout days per week"
        options={DAYS_PER_WEEK_OPTIONS}
        value={details.daysPerWeek}
        onChange={onDaysPerWeekChange}
      />

      <Text style={styles.label}>Training days ({details.weekdays.length}/{details.daysPerWeek} selected)</Text>
      <View style={styles.weekdayRow}>
        {WEEKDAY_OPTIONS.map((w) => {
          const selected = details.weekdays.includes(w.value);
          return (
            <PressableScale
              key={w.value}
              haptic="selection"
              onPress={() => toggleWeekday(w.value)}
              style={[styles.weekdayChip, selected && styles.weekdayChipSelected]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={w.label}
            >
              <Text style={[styles.weekdayText, selected && styles.weekdayTextSelected]}>{w.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.row}>
        <Input
          label="Current weight (kg)"
          keyboardType="decimal-pad"
          value={details.currentWeight}
          onChangeText={(v) => onChange({ currentWeight: v })}
          leftIcon={<Scale size={18} color={colors.primaryLight} />}
          containerStyle={styles.half}
        />
        <Input
          label="Goal weight (kg)"
          keyboardType="decimal-pad"
          value={details.goalWeight}
          onChangeText={(v) => onChange({ goalWeight: v })}
          leftIcon={<Scale size={18} color={colors.primaryLight} />}
          containerStyle={styles.half}
        />
      </View>

      <View style={styles.row}>
        <Input
          label="Height (cm)"
          keyboardType="decimal-pad"
          value={details.height}
          onChangeText={(v) => onChange({ height: v })}
          leftIcon={<Ruler size={18} color={colors.textSecondary} />}
          containerStyle={styles.half}
        />
        <Input
          label="Age"
          keyboardType="number-pad"
          value={details.age}
          onChangeText={(v) => onChange({ age: v })}
          leftIcon={<User size={18} color={colors.textSecondary} />}
          containerStyle={styles.half}
        />
      </View>

      <ChipGroup label="Sex" options={SEX_OPTIONS} value={details.sex} onChange={(v) => onChange({ sex: v })} />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
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
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  weekdayChip: {
    width: 46,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  weekdayTextSelected: {
    color: colors.primaryLight,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
}));
