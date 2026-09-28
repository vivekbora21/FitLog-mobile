import React, { useState, useEffect, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Gauge,
  Heart,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { PressableScale } from '../../components/ui';
import type { LastPerformance } from '../../api/client';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { formatRelativeDay, parseNumberInput } from '../../lib/format';
import { newSet, type DraftExercise, type DraftSet } from './draft';
import { formatClock } from './RestTimer';

const INCLINE_PRESETS = [
  { label: '0%', value: '0', desc: 'Flat' },
  { label: '4%', value: '4', desc: 'Low' },
  { label: '8%', value: '8', desc: 'Mod' },
  { label: '10%', value: '10', desc: 'Steep' },
  { label: '12%', value: '12', desc: 'Peak' },
  { label: '15%', value: '15', desc: 'Max' },
];

const INTENSITY_ZONES = [
  { key: 'Warm-up', label: 'Warm-up', color: 'amber' as const },
  { key: 'Zone 2', label: 'Zone 2 (Fat Burn)', color: 'primaryLight' as const },
  { key: 'Zone 3', label: 'Zone 3 (Tempo)', color: 'violet' as const },
  { key: 'HIIT', label: 'HIIT / Max', color: 'rose' as const },
];

const DURATION_PRESETS = [5, 10, 15, 20, 25, 30, 45];

interface Props {
  exercise: DraftExercise;
  index: number;
  count: number;
  last?: LastPerformance;
  onChange: (fn: (ex: DraftExercise) => DraftExercise) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onSetCompleted: (restSeconds: number) => void;
}

export function CardioExerciseCard({
  exercise: ex,
  index,
  count,
  last,
  onChange,
  onRemove,
  onMove,
  onSetCompleted,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  const [activeIntervalIndex, setActiveIntervalIndex] = useState(0);
  const [showExtras, setShowExtras] = useState(false);

  // Live stopwatch state for cardio
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Every full minute, sync to active interval duration if empty or timer-driven
          if (next % 60 === 0) {
            const mins = String(Math.round(next / 60));
            updateInterval(activeIntervalIndex, { durationMinutes: mins });
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, activeIntervalIndex]);

  const updateSet = (key: string, patch: Partial<DraftSet>) =>
    onChange((e) => ({
      ...e,
      sets: e.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }));

  const updateInterval = (idx: number, patch: Partial<DraftSet>) => {
    const targetSet = ex.sets[idx];
    if (targetSet) {
      updateSet(targetSet.key, patch);
    }
  };

  const activeSet = ex.sets[activeIntervalIndex] || ex.sets[0];

  const handleInclinePreset = (val: string) => {
    if (activeSet) {
      updateSet(activeSet.key, { incline: val });
    }
  };

  const handleIntensityPreset = (val: string) => {
    if (activeSet) {
      updateSet(activeSet.key, { intensity: val });
    }
  };

  const handleDurationPreset = (mins: number) => {
    if (activeSet) {
      updateSet(activeSet.key, { durationMinutes: String(mins) });
    }
  };

  const toggleStopwatch = () => {
    if (isTimerRunning) {
      setIsTimerRunning(false);
      if (elapsedSeconds > 30 && activeSet) {
        const roundedMins = Math.max(1, Math.round(elapsedSeconds / 60));
        updateSet(activeSet.key, { durationMinutes: String(roundedMins) });
      }
    } else {
      setIsTimerRunning(true);
    }
  };

  const resetStopwatch = () => {
    setIsTimerRunning(false);
    setElapsedSeconds(0);
  };

  const formatTimerDigits = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Last performance summary text
  const lastText = last?.sets?.length
    ? last.sets.map((s) => `${s.reps || 20}m`).join(', ')
    : null;

  return (
    <View style={styles.card}>
      {/* Exercise Header */}
      <View style={styles.header}>
        <View style={styles.badgeWrap}>
          <Text style={styles.index}>{index + 1}</Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {ex.name}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.cardioPill}>
              <Activity size={10} color={colors.primaryLight} />
              <Text style={styles.cardioPillText}>Cardio</Text>
            </View>
            {ex.targetPrescription ? (
              <Text style={styles.prescriptionText} numberOfLines={1}>
                {ex.targetPrescription}
              </Text>
            ) : lastText ? (
              <Text style={styles.prescriptionText} numberOfLines={1}>
                Last {formatRelativeDay(last!.date)}: {lastText}
              </Text>
            ) : null}
          </View>
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

      {/* Incline Intensity Selector */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <TrendingUp size={12} color={colors.primaryLight} />
          <Text style={styles.sectionTitle}>Incline Intensity</Text>
        </View>
        <Text style={styles.sectionCurrentValue}>
          {activeSet?.incline ? `${activeSet.incline}% Incline` : '0% (Flat)'}
        </Text>
      </View>

      <View style={styles.presetPillsRow}>
        {INCLINE_PRESETS.map((p) => {
          const isSelected = (activeSet?.incline || '0') === p.value;
          return (
            <PressableScale
              key={p.value}
              haptic="selection"
              onPress={() => handleInclinePreset(p.value)}
              style={[styles.inclineChip, isSelected && styles.inclineChipSelected]}
              accessibilityLabel={`Set incline to ${p.label} (${p.desc})`}
            >
              <Text style={[styles.inclineChipText, isSelected && styles.inclineChipTextSelected]}>
                {p.label}
              </Text>
              <Text style={[styles.inclineChipDesc, isSelected && styles.inclineChipDescSelected]}>
                {p.desc}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Cardio Zone / Intensity Presets */}
      <View style={styles.zoneRow}>
        {INTENSITY_ZONES.map((z) => {
          const isSelected = (activeSet?.intensity || 'Zone 2').toLowerCase().includes(z.key.toLowerCase());
          return (
            <PressableScale
              key={z.key}
              haptic="selection"
              onPress={() => handleIntensityPreset(z.key)}
              style={[
                styles.zoneChip,
                isSelected && {
                  backgroundColor: colors.primarySurface,
                  borderColor: colors[z.color],
                },
              ]}
              accessibilityLabel={`Set intensity to ${z.label}`}
            >
              <Text
                style={[
                  styles.zoneChipText,
                  isSelected && { color: colors[z.color], fontWeight: '800' },
                ]}
              >
                {z.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Live Timer / Stopwatch Bar */}
      <View style={styles.stopwatchBar}>
        <View style={styles.stopwatchLeft}>
          <View style={[styles.pulseDot, isTimerRunning && styles.pulseDotActive]} />
          <Text style={styles.stopwatchLabel}>Live Cardio Timer</Text>
          <Text style={styles.stopwatchDigits}>{formatTimerDigits(elapsedSeconds)}</Text>
        </View>
        <View style={styles.stopwatchActions}>
          <PressableScale
            haptic="medium"
            onPress={toggleStopwatch}
            style={[styles.stopwatchBtn, isTimerRunning && styles.stopwatchBtnRunning]}
            accessibilityLabel={isTimerRunning ? 'Pause timer' : 'Start live cardio timer'}
          >
            {isTimerRunning ? (
              <Pause size={14} color="#FFFFFF" />
            ) : (
              <Play size={14} color="#FFFFFF" />
            )}
            <Text style={styles.stopwatchBtnText}>{isTimerRunning ? 'Pause' : 'Start'}</Text>
          </PressableScale>
          {elapsedSeconds > 0 && (
            <PressableScale
              haptic="selection"
              onPress={resetStopwatch}
              style={styles.stopwatchResetBtn}
              accessibilityLabel="Reset timer"
            >
              <RotateCcw size={14} color={colors.textMuted} />
            </PressableScale>
          )}
        </View>
      </View>

      {/* Interval Table Header */}
      <View style={styles.tableHead}>
        <Text style={[styles.headText, styles.intCol]}>Int</Text>
        <Text style={[styles.headText, styles.prevCol]}>Target</Text>
        <Text style={[styles.headText, styles.inputCol]}>Time (min)</Text>
        <Text style={[styles.headText, styles.inputCol]}>Incline %</Text>
        <Text style={[styles.headText, styles.inputCol]}>Speed (km/h)</Text>
        <View style={styles.doneCol}>
          <Check size={14} color={colors.textMuted} strokeWidth={3} />
        </View>
      </View>

      {/* Interval Rows */}
      {ex.sets.map((s, si) => {
        const isCurrent = si === activeIntervalIndex;
        const targetDesc = s.durationMinutes ? `${s.durationMinutes}m` : '15m';

        return (
          <View
            key={s.key}
            style={[
              styles.setRow,
              s.done && styles.setRowDone,
              isCurrent && !s.done && styles.setRowCurrent,
            ]}
          >
            {/* Interval Number */}
            <PressableScale
              haptic="selection"
              onPress={() => setActiveIntervalIndex(si)}
              style={styles.intCol}
              accessibilityLabel={`Interval ${si + 1}. Tap to select`}
            >
              <Text style={[styles.setNumber, { color: s.done ? colors.primaryLight : colors.textPrimary }]}>
                {si + 1}
              </Text>
            </PressableScale>

            {/* Target / Previous Summary */}
            <PressableScale
              haptic="selection"
              onPress={() => {
                setActiveIntervalIndex(si);
                if (ex.targetPrescription) {
                  // Pre-fill defaults
                  updateSet(s.key, { durationMinutes: '20', incline: '12', speedKmh: '4.8' });
                }
              }}
              style={styles.prevCol}
              accessibilityLabel="Tap to auto-fill target duration and incline"
            >
              <Text style={styles.prevText} numberOfLines={1}>
                {targetDesc}
              </Text>
            </PressableScale>

            {/* Time (Minutes) Input */}
            <TextInput
              style={[styles.input, styles.inputCol]}
              value={s.durationMinutes}
              onChangeText={(durationMinutes) => updateSet(s.key, { durationMinutes })}
              onFocus={() => setActiveIntervalIndex(si)}
              keyboardType="number-pad"
              placeholder="15"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primaryLight}
              selectTextOnFocus
              accessibilityLabel={`Interval ${si + 1} duration in minutes`}
            />

            {/* Incline (%) Input */}
            <TextInput
              style={[styles.input, styles.inputCol]}
              value={s.incline}
              onChangeText={(incline) => updateSet(s.key, { incline })}
              onFocus={() => setActiveIntervalIndex(si)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primaryLight}
              selectTextOnFocus
              accessibilityLabel={`Interval ${si + 1} incline percentage`}
            />

            {/* Speed (km/h) / Level Input */}
            <TextInput
              style={[styles.input, styles.inputCol]}
              value={s.speedKmh}
              onChangeText={(speedKmh) => updateSet(s.key, { speedKmh })}
              onFocus={() => setActiveIntervalIndex(si)}
              keyboardType="decimal-pad"
              placeholder="4.8"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primaryLight}
              selectTextOnFocus
              accessibilityLabel={`Interval ${si + 1} speed in km/h`}
            />

            {/* Complete Checkmark */}
            <View style={styles.doneCol}>
              <PressableScale
                haptic="medium"
                onPress={() => {
                  const done = !s.done;
                  const fill = done && !s.durationMinutes ? { durationMinutes: '15' } : {};
                  updateSet(s.key, { done, ...fill });
                  if (done) onSetCompleted(ex.restSeconds || 0);
                }}
                style={[styles.doneBtn, s.done && styles.doneBtnActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.done }}
                accessibilityLabel={`Mark interval ${si + 1} done`}
              >
                <Check
                  size={16}
                  color={s.done ? colors.textInverse : colors.textMuted}
                  strokeWidth={3}
                />
              </PressableScale>
            </View>
          </View>
        );
      })}

      {/* Quick Duration Stepper Chips */}
      <View style={styles.quickDurationRow}>
        <Text style={styles.quickDurationLabel}>Quick Minutes:</Text>
        {DURATION_PRESETS.map((m) => (
          <PressableScale
            key={m}
            haptic="selection"
            onPress={() => handleDurationPreset(m)}
            style={[
              styles.quickDurationChip,
              activeSet?.durationMinutes === String(m) && styles.quickDurationChipActive,
            ]}
          >
            <Text
              style={[
                styles.quickDurationText,
                activeSet?.durationMinutes === String(m) && styles.quickDurationTextActive,
              ]}
            >
              {m}m
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* Expandable Extra Metrics: Heart Rate & Calories */}
      <PressableScale
        haptic="selection"
        onPress={() => setShowExtras(!showExtras)}
        style={styles.extrasToggle}
        accessibilityLabel="Toggle heart rate, distance, and calories"
      >
        <Text style={styles.extrasToggleText}>
          {showExtras ? 'Hide Heart Rate & Calories' : 'Add Heart Rate, Distance & Calories'}
        </Text>
        {showExtras ? (
          <ChevronUp size={14} color={colors.textMuted} />
        ) : (
          <ChevronDown size={14} color={colors.textMuted} />
        )}
      </PressableScale>

      {showExtras && (
        <View style={styles.extrasBox}>
          <View style={styles.extraField}>
            <View style={styles.extraFieldLabelRow}>
              <Heart size={12} color={colors.rose} />
              <Text style={styles.extraFieldLabel}>Heart Rate (bpm)</Text>
            </View>
            <TextInput
              style={styles.extraInput}
              value={activeSet?.heartRate || ''}
              onChangeText={(heartRate) => activeSet && updateSet(activeSet.key, { heartRate })}
              keyboardType="number-pad"
              placeholder="e.g. 130"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.extraField}>
            <View style={styles.extraFieldLabelRow}>
              <Gauge size={12} color={colors.primaryLight} />
              <Text style={styles.extraFieldLabel}>Distance (km)</Text>
            </View>
            <TextInput
              style={styles.extraInput}
              value={activeSet?.distanceKm || ''}
              onChangeText={(distanceKm) => activeSet && updateSet(activeSet.key, { distanceKm })}
              keyboardType="decimal-pad"
              placeholder="e.g. 2.5"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.extraField}>
            <View style={styles.extraFieldLabelRow}>
              <Flame size={12} color={colors.amber} />
              <Text style={styles.extraFieldLabel}>Calories (kcal)</Text>
            </View>
            <TextInput
              style={styles.extraInput}
              value={activeSet?.calories || ''}
              onChangeText={(calories) => activeSet && updateSet(activeSet.key, { calories })}
              keyboardType="number-pad"
              placeholder="e.g. 180"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
      )}

      {/* Card Actions Footer */}
      <View style={styles.actions}>
        <PressableScale
          haptic="selection"
          onPress={() =>
            onChange((e) => {
              const lastSet = e.sets[e.sets.length - 1];
              return {
                ...e,
                sets: [
                  ...e.sets,
                  newSet('0', '0', 'NORMAL', {
                    durationMinutes: lastSet?.durationMinutes || '15',
                    incline: lastSet?.incline || '0',
                    speedKmh: lastSet?.speedKmh || '',
                    intensity: lastSet?.intensity || 'Zone 2',
                  }),
                ],
              };
            })
          }
          style={styles.actionBtn}
          accessibilityLabel={`Add interval to ${ex.name}`}
        >
          <Plus size={14} color={colors.primaryLight} />
          <Text style={styles.actionText}>Add interval</Text>
        </PressableScale>

        {ex.sets.length > 1 && (
          <PressableScale
            haptic="selection"
            onPress={() =>
              onChange((e) => ({
                ...e,
                sets: e.sets.slice(0, -1),
              }))
            }
            style={styles.actionBtn}
            accessibilityLabel={`Remove last interval from ${ex.name}`}
          >
            <X size={14} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Remove</Text>
          </PressableScale>
        )}

        <View style={styles.flex} />

        {ex.restSeconds > 0 && (
          <View style={styles.restBadge}>
            <Timer size={12} color={colors.amber} />
            <Text style={styles.restText}>{formatClock(ex.restSeconds)} rest</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function IconBtn({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <PressableScale
      haptic="selection"
      disabled={disabled}
      onPress={onPress}
      style={styles.iconBtn}
      accessibilityLabel={label}
    >
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
  badgeWrap: {
    marginRight: spacing.xs,
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
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  cardioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  cardioPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  prescriptionText: {
    fontSize: 11,
    color: colors.textMuted,
    flex: 1,
  },
  iconBtn: {
    width: 32,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Incline presets section
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: 6,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCurrentValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  presetPillsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
  },
  inclineChip: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inclineChipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  inclineChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  inclineChipTextSelected: {
    color: colors.primaryLight,
  },
  inclineChipDesc: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
  },
  inclineChipDescSelected: {
    color: colors.primaryLight,
  },

  // Zone Pills
  zoneRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  zoneChip: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },

  // Stopwatch bar
  stopwatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  stopwatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  pulseDotActive: {
    backgroundColor: colors.rose,
  },
  stopwatchLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  stopwatchDigits: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginLeft: 2,
  },
  stopwatchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  stopwatchBtnRunning: {
    backgroundColor: colors.amber,
  },
  stopwatchBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stopwatchResetBtn: {
    padding: 4,
  },

  // Table
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  headText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  setRowDone: {
    backgroundColor: colors.primarySurface,
  },
  setRowCurrent: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primaryLight,
  },
  intCol: {
    width: 24,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevCol: {
    width: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCol: {
    flex: 1,
  },
  doneCol: {
    width: 40,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  prevText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneBtn: {
    width: 38,
    height: 38,
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

  // Quick minutes row
  quickDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 4,
  },
  quickDurationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: 2,
  },
  quickDurationChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  quickDurationChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  quickDurationText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickDurationTextActive: {
    color: colors.primaryLight,
  },

  // Extras
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  extrasToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  extrasBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 4,
  },
  extraField: {
    flex: 1,
  },
  extraFieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  extraFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  extraInput: {
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Actions footer
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
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  restBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  restText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
}));
