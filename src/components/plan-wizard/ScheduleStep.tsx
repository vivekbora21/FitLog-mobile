import React from 'react';
import { View, Text } from 'react-native';
import { ChipGroup, Input, PressableScale } from '../ui';
import { radius, spacing, makeStyles } from '../../theme';
import { parseNumberInput } from '../../lib/format';
import { isNoSupportedSplitResult, type PlanPreviewResult } from '../../types';
import {
  DAYS_PER_WEEK_OPTIONS,
  DURATION_PRESETS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  MAX_PLAN_DAYS,
  MIN_PLAN_DAYS,
  WEEKDAY_OPTIONS,
} from './constants';
import { infoMessages, messageText, warnMessages } from './messageCopy';
import { DEFAULT_SPREAD_BY_DAYS_PER_WEEK, type PlanWizardState } from './types';

interface ScheduleStepProps {
  state: PlanWizardState;
  onChange: (patch: Partial<PlanWizardState>) => void;
  preview: { data?: PlanPreviewResult };
}

/** Keeps the user's existing picks where possible, then fills or trims to
 * the new count using the 6.1 default spread -- never a naive contiguous
 * range (that would misrepresent the schedule and could spuriously read as
 * a consecutive-day run). */
function adjustWeekdaysForCount(current: number[], newCount: number): number[] {
  if (current.length === newCount) return [...current].sort((a, b) => a - b);
  if (current.length > newCount) {
    return [...current].sort((a, b) => a - b).slice(0, newCount);
  }
  const defaultSpread = DEFAULT_SPREAD_BY_DAYS_PER_WEEK[newCount] ?? [];
  const result = [...current];
  for (const day of defaultSpread) {
    if (result.length >= newCount) break;
    if (!result.includes(day)) result.push(day);
  }
  for (const opt of WEEKDAY_OPTIONS) {
    if (result.length >= newCount) break;
    if (!result.includes(opt.value)) result.push(opt.value);
  }
  return result.sort((a, b) => a - b);
}

type DurationChipValue = number | 'custom';

/** Step 3 "Your schedule" (spec v1.6 section 8.3). Defect #4: days-per-week
 * and plan length each have exactly one control here -- no duplicate chip +
 * free-text pair, and no second days-per-week picker inside a split step. */
export function ScheduleStep({ state, onChange, preview }: ScheduleStepProps) {
  const styles = useStyles();

  const durationNum = parseNumberInput(state.durationDays);
  const isPreset = durationNum != null && DURATION_PRESETS.some((d) => d.value === durationNum);
  const [forceCustom, setForceCustom] = React.useState(!isPreset);
  const showCustomInput = forceCustom || !isPreset;

  const onDaysPerWeekChange = (n: number) => {
    onChange({ daysPerWeek: n, weekdays: adjustWeekdaysForCount(state.weekdays, n) });
  };

  const toggleWeekday = (day: number) => {
    const has = state.weekdays.includes(day);
    const next = has ? state.weekdays.filter((d) => d !== day) : [...state.weekdays, day].sort((a, b) => a - b);
    onChange({ weekdays: next });
  };

  const roadmap = preview.data && !isNoSupportedSplitResult(preview.data) ? preview.data : null;
  const messages = roadmap?.engine.messages ?? [];
  const scheduleWarnings = [...warnMessages(messages), ...infoMessages(messages)].filter((m) =>
    ['CONSECUTIVE_DAYS', 'BEGINNER_HIGH_FREQUENCY', 'CUT_HIGH_FREQUENCY_RECOVERY'].includes(m.code)
  );

  return (
    <View>
      <Text style={styles.heading}>Your schedule</Text>
      <Text style={styles.body}>How many days you train, which days, and how long the plan runs.</Text>

      <ChipGroup
        label="Days per week"
        options={DAYS_PER_WEEK_OPTIONS}
        value={state.daysPerWeek}
        onChange={onDaysPerWeekChange}
      />

      <Text style={styles.label}>
        Training days ({state.weekdays.length}/{state.daysPerWeek} selected)
      </Text>
      <View style={styles.weekdayRow}>
        {WEEKDAY_OPTIONS.map((w) => {
          const selected = state.weekdays.includes(w.value);
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
      {state.weekdays.length !== state.daysPerWeek ? (
        <Text style={styles.error}>
          Pick {state.daysPerWeek} day{state.daysPerWeek === 1 ? '' : 's'} ({state.weekdays.length} selected).
        </Text>
      ) : null}

      {scheduleWarnings.map((m, idx) => (
        <View key={`${m.code}-${idx}`} style={styles.warnBox}>
          <Text style={styles.warnText}>{messageText(m)}</Text>
        </View>
      ))}

      <Text style={styles.label}>Plan length</Text>
      <ChipGroup<DurationChipValue>
        options={[...DURATION_PRESETS, { value: 'custom', label: 'Custom' }]}
        value={showCustomInput ? 'custom' : (durationNum as number)}
        onChange={(v) => {
          if (v === 'custom') {
            setForceCustom(true);
            return;
          }
          setForceCustom(false);
          onChange({ durationDays: String(v), durationEdited: true });
        }}
      />
      {showCustomInput ? (
        <Input
          label={`Custom length (${MIN_PLAN_DAYS}–${MAX_PLAN_DAYS} days)`}
          keyboardType="number-pad"
          value={state.durationDays}
          onChangeText={(v) => onChange({ durationDays: v, durationEdited: true })}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Your setup</Text>
      <ChipGroup
        label="Experience"
        options={EXPERIENCE_OPTIONS}
        value={state.experience}
        onChange={(v) => onChange({ experience: v })}
      />
      {!state.experience ? <Text style={styles.hint}>Select your training experience to continue.</Text> : null}

      <ChipGroup
        label="Equipment"
        options={EQUIPMENT_OPTIONS}
        value={state.equipment}
        onChange={(v) => onChange({ equipment: v, splitSlug: null })}
      />
      {!state.equipment ? <Text style={styles.hint}>Select your equipment to continue.</Text> : null}
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
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  warnBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  warnText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
}));
