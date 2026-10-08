import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ArrowDown, ArrowUp, BookOpen, Check, Plus, Timer, Trash2, X, Flame } from 'lucide-react-native';
import { PressableScale } from '../../components/ui';
import type { LastPerformance } from '../../api/client';
import { makeStyles, radius, spacing, useTheme, type Palette } from '../../theme';
import { formatRelativeDay } from '../../lib/format';
import { isCardioExercise, newSet, type DraftExercise, type DraftSet, type SetType } from './draft';
import { formatClock } from './RestTimer';
import { CardioExerciseCard } from './CardioExerciseCard';
import { ExerciseGuideModal, type ExerciseGuide } from './ExerciseGuideModal';

const SET_TYPE_ORDER: SetType[] = ['NORMAL', 'WARMUP', 'DROP', 'FAILURE'];
const SET_TYPE_META: Record<SetType, { short: string; label: string; color: keyof Palette }> = {
  NORMAL: { short: '', label: 'Working set', color: 'textSecondary' },
  WARMUP: { short: 'W', label: 'Warm-up', color: 'amber' },
  DROP: { short: 'D', label: 'Drop set', color: 'violet' },
  FAILURE: { short: 'F', label: 'To failure', color: 'rose' },
};
const REST_PRESETS = [60, 90, 120, 180, 0];

// Warm-up percentages for a typical working set weight
const WARMUP_SCHEMES: { pct: number; reps: number }[] = [
  { pct: 0.5, reps: 10 },   // 50% × 10
  { pct: 0.7, reps: 5 },    // 70% × 5
  { pct: 0.85, reps: 3 },   // 85% × 3
];

interface Props {
  exercise: DraftExercise;
  index: number;
  count: number;
  last?: LastPerformance;
  onChange: (fn: (ex: DraftExercise) => DraftExercise) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  /** Fired when a set flips to done, to kick off the rest timer. */
  onSetCompleted: (restSeconds: number) => void;
}

export function ExerciseCard({ exercise: ex, index, count, last, onChange, onRemove, onMove, onSetCompleted }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [guideVisible, setGuideVisible] = useState(false);
  const [showRpeRir, setShowRpeRir] = useState<Record<string, boolean>>({});

  // If this is a cardio movement (treadmill, bike, rowing, incline walk, etc.), render the specialized cardio card
  if (ex.isCardio || isCardioExercise(ex.name, ex.muscle)) {
    return (
      <CardioExerciseCard
        exercise={ex}
        index={index}
        count={count}
        last={last}
        onChange={onChange}
        onRemove={onRemove}
        onMove={onMove}
        onSetCompleted={onSetCompleted}
      />
    );
  }

  const updateSet = (key: string, patch: Partial<DraftSet>) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));

  const cycleType = (s: DraftSet) =>
    updateSet(s.key, { type: SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(s.type) + 1) % SET_TYPE_ORDER.length] });

  const cycleRest = () => {
    const i = REST_PRESETS.indexOf(ex.restSeconds);
    onChange((e) => ({ ...e, restSeconds: REST_PRESETS[(i + 1) % REST_PRESETS.length] }));
  };

  // Add warm-up sets based on the first working-set weight
  const addWarmupSets = () => {
    const firstWorking = ex.sets.find((s) => s.type === 'NORMAL' || s.type === 'DROP' || s.type === 'FAILURE');
    const workingWeight = parseFloat(firstWorking?.weight || last?.sets[0]?.weight_kg?.toString() || '0');

    if (workingWeight <= 0) {
      // No weight to base warm-up off — just add one bodyweight/empty warm-up
      const warmSet = newSet('', '', 'WARMUP');
      onChange((e) => ({ ...e, sets: [warmSet, ...e.sets] }));
      return;
    }

    const warmSets = WARMUP_SCHEMES.map(({ pct, reps }) =>
      newSet(String(Math.round(workingWeight * pct * 2) / 2), String(reps), 'WARMUP')
    );
    onChange((e) => ({ ...e, sets: [...warmSets, ...e.sets.filter((s) => s.type !== 'WARMUP')] }));
  };

  const hasWarmupSets = ex.sets.some((s) => s.type === 'WARMUP');

  // Working-set numbering skips warm-ups, matching how lifters count.
  const setLabels = workingSetLabels(ex.sets);

  // Build the guide object
  const guide: ExerciseGuide = {
    name: ex.name,
    muscle: ex.muscle,
    instructions: ex.instructions,
    videoUrl: ex.videoUrl,
    targetRpe: ex.targetRpe,
  };

  const toggleRpeRir = (key: string) =>
    setShowRpeRir((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <View style={styles.card}>
      {/* Guide modal */}
      <ExerciseGuideModal visible={guideVisible} guide={guide} onClose={() => setGuideVisible(false)} />

      <View style={styles.header}>
        <Text style={styles.index}>{index + 1}</Text>
        <View style={styles.flex}>
          <PressableScale haptic="selection" onPress={() => setGuideVisible(true)} style={styles.namePressable}>
            <Text style={styles.name} numberOfLines={2}>
              {ex.name}
            </Text>
            {ex.instructions ? (
              <BookOpen size={12} color={colors.primaryLight} style={{ marginLeft: 4, marginTop: 2 }} />
            ) : null}
          </PressableScale>
          {last ? (
            <Text style={styles.lastLine} numberOfLines={1}>
              Last {formatRelativeDay(last.date)}: {last.sets.filter((s) => s.set_type !== 'WARMUP').map((s) => `${s.weight_kg}×${s.reps}`).join(', ')}
            </Text>
          ) : ex.muscle ? (
            <Text style={styles.lastLine}>{ex.muscle}</Text>
          ) : null}
          {ex.targetRpe ? (
            <Text style={styles.rpePrescription}>Target RPE {ex.targetRpe}</Text>
          ) : null}
        </View>
        <IconBtn label={`Move ${ex.name} up`} disabled={index === 0} onPress={() => onMove(-1)}>
          <ArrowUp size={16} color={index === 0 ? colors.border : colors.textMuted} />
        </IconBtn>
        <IconBtn label={`Move ${ex.name} down`} disabled={index === count - 1} onPress={() => onMove(1)}>
          <ArrowDown size={16} color={index === count - 1 ? colors.border : colors.textMuted} />
        </IconBtn>
        <IconBtn label={`Remove ${ex.name}`} onPress={onRemove}>
          <Trash2 size={16} color={colors.textMuted} />
        </IconBtn>
      </View>

      <View style={styles.tableHead}>
        <Text style={[styles.headText, styles.setCol]}>Set</Text>
        <Text style={[styles.headText, styles.prevCol]}>Previous</Text>
        <Text style={[styles.headText, styles.inputCol]}>kg</Text>
        <Text style={[styles.headText, styles.inputCol]}>Reps</Text>
        <View style={styles.doneCol}>
          <Check size={14} color={colors.textMuted} strokeWidth={3} />
        </View>
      </View>

      {ex.sets.map((s, si) => {
        const meta = SET_TYPE_META[s.type];
        const prev = last?.sets[si];
        const prevText = prev ? `${prev.weight_kg}×${prev.reps}` : '—';
        const isWarmup = s.type === 'WARMUP';
        const rpeRirOpen = showRpeRir[s.key];

        return (
          <View key={s.key}>
            <View style={[styles.setRow, s.done && styles.setRowDone, isWarmup && styles.setRowWarmup]}>
              <PressableScale
                haptic="selection"
                onPress={() => cycleType(s)}
                style={styles.setCol}
                accessibilityLabel={`Set ${si + 1}, ${meta.label}. Tap to change set type`}
              >
                <Text style={[styles.setNumber, { color: colors[meta.color] }]}>{setLabels[si]}</Text>
              </PressableScale>
              <PressableScale
                haptic="selection"
                disabled={!prev}
                onPress={() => prev && updateSet(s.key, { weight: String(prev.weight_kg), reps: String(prev.reps) })}
                style={styles.prevCol}
                accessibilityLabel={prev ? `Previous ${prevText}. Tap to copy` : 'No previous set'}
              >
                <Text style={styles.prevText} numberOfLines={1}>
                  {prevText}
                </Text>
              </PressableScale>
              <TextInput
                style={[styles.input, styles.inputCol, isWarmup && styles.inputWarmup]}
                value={s.weight}
                onChangeText={(weight) => updateSet(s.key, { weight })}
                keyboardType="decimal-pad"
                placeholder={prev ? String(prev.weight_kg) : '0'}
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primaryLight}
                selectTextOnFocus
                accessibilityLabel={`${ex.name} set ${si + 1} weight in kilograms`}
              />
              <TextInput
                style={[styles.input, styles.inputCol, isWarmup && styles.inputWarmup]}
                value={s.reps}
                onChangeText={(reps) => updateSet(s.key, { reps })}
                keyboardType="number-pad"
                placeholder={prev ? String(prev.reps) : '0'}
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primaryLight}
                selectTextOnFocus
                accessibilityLabel={`${ex.name} set ${si + 1} reps`}
              />
              <View style={styles.doneCol}>
                <PressableScale
                  haptic="medium"
                  onPress={() => {
                    const done = !s.done;
                    const fill = done && !s.reps && prev ? { weight: s.weight || String(prev.weight_kg), reps: String(prev.reps) } : {};
                    updateSet(s.key, { done, ...fill });
                    if (done) {
                      onSetCompleted(ex.restSeconds);
                      // Auto-open RPE/RIR for working sets when marked done
                      if (!isWarmup) {
                        setShowRpeRir((prev) => ({ ...prev, [s.key]: true }));
                      }
                    }
                  }}
                  style={[styles.doneBtn, s.done && styles.doneBtnActive]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.done }}
                  accessibilityLabel={`Mark set ${si + 1} done`}
                >
                  <Check size={16} color={s.done ? colors.textInverse : colors.textMuted} strokeWidth={3} />
                </PressableScale>
              </View>
            </View>

            {/* RPE / RIR inline row — appears after marking a working set done */}
            {rpeRirOpen && !isWarmup ? (
              <View style={styles.rpeRirRow}>
                <Flame size={12} color={colors.rose} />
                <TextInput
                  style={styles.rpeInput}
                  value={s.rpe ?? ''}
                  onChangeText={(rpe) => updateSet(s.key, { rpe })}
                  keyboardType="decimal-pad"
                  placeholder="RPE"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.rose}
                  selectTextOnFocus
                  accessibilityLabel={`Set ${si + 1} Rate of Perceived Exertion`}
                />
                <Text style={styles.rpeSlash}>/</Text>
                <TextInput
                  style={styles.rpeInput}
                  value={s.rir ?? ''}
                  onChangeText={(rir) => updateSet(s.key, { rir })}
                  keyboardType="decimal-pad"
                  placeholder="RIR"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.violet}
                  selectTextOnFocus
                  accessibilityLabel={`Set ${si + 1} Reps in Reserve`}
                />
                <PressableScale
                  haptic="selection"
                  onPress={() => toggleRpeRir(s.key)}
                  style={styles.rpeClose}
                  accessibilityLabel="Close RPE/RIR"
                >
                  <X size={12} color={colors.textMuted} />
                </PressableScale>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.actions}>
        <PressableScale
          haptic="selection"
          onPress={() =>
            onChange((e) => {
              const lastSet = e.sets[e.sets.length - 1];
              return { ...e, sets: [...e.sets, newSet(lastSet?.weight, lastSet?.reps)] };
            })
          }
          style={styles.actionBtn}
          accessibilityLabel={`Add set to ${ex.name}`}
        >
          <Plus size={14} color={colors.primaryLight} />
          <Text style={styles.actionText}>Add set</Text>
        </PressableScale>

        {/* Warm-up sets shortcut */}
        {!hasWarmupSets ? (
          <PressableScale
            haptic="selection"
            onPress={addWarmupSets}
            style={styles.actionBtn}
            accessibilityLabel={`Add warm-up sets to ${ex.name}`}
          >
            <Flame size={14} color={colors.amber} />
            <Text style={[styles.actionText, { color: colors.amber }]}>Warm-up</Text>
          </PressableScale>
        ) : null}

        {ex.sets.length > 1 && (
          <PressableScale
            haptic="selection"
            onPress={() => onChange((e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
            style={styles.actionBtn}
            accessibilityLabel={`Remove last set from ${ex.name}`}
          >
            <X size={14} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Remove</Text>
          </PressableScale>
        )}
        <View style={styles.flex} />
        <PressableScale
          haptic="selection"
          onPress={cycleRest}
          style={styles.actionBtn}
          accessibilityLabel={`Rest timer ${ex.restSeconds ? formatClock(ex.restSeconds) : 'off'}. Tap to change`}
        >
          <Timer size={14} color={colors.amber} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {ex.restSeconds ? formatClock(ex.restSeconds) : 'Off'}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

function workingSetLabels(sets: DraftSet[]): string[] {
  const labels: string[] = [];
  let working = 0;
  for (const s of sets) {
    if (s.type !== 'WARMUP') working += 1;
    labels.push(SET_TYPE_META[s.type].short || String(working));
  }
  return labels;
}

function IconBtn({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <PressableScale haptic="selection" disabled={disabled} onPress={onPress} style={styles.iconBtn} accessibilityLabel={label}>
      {children}
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  index: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
    color: colors.primaryLight,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 26,
    overflow: 'hidden',
    marginRight: spacing.xs,
  },
  namePressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  lastLine: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  rpePrescription: {
    fontSize: 11,
    color: colors.violet,
    fontWeight: '700',
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: 4,
  },
  headText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  setRowDone: {
    backgroundColor: colors.primarySurface,
  },
  setRowWarmup: {
    backgroundColor: 'rgba(217,119,6,0.06)',
  },
  setCol: {
    width: 30,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevCol: {
    width: 64,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCol: {
    flex: 1,
  },
  doneCol: {
    width: 44,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  prevText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  input: {
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputWarmup: {
    borderColor: 'rgba(217,119,6,0.4)',
    backgroundColor: 'rgba(217,119,6,0.06)',
  },
  doneBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },

  // RPE / RIR inline row
  rpeRirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 30 + spacing.xs + spacing.sm, // align with set col offset
    paddingBottom: 4,
    paddingRight: 44 + spacing.sm,
    marginTop: -2,
  },
  rpeInput: {
    flex: 1,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  rpeSlash: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rpeClose: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
}));
