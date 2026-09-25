import React, { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../api/client';
import { Button, Input, PressableScale } from '../../components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { invalidateTrackingData } from '../../lib/queries';
import { haptics } from '../../lib/haptics';
import { parseNumberInput } from '../../lib/format';
import type { CardioModality } from '../../shared/types';

const MODALITY_LABELS: Record<CardioModality, string> = {
  TREADMILL: 'Treadmill',
  CYCLING: 'Cycling',
  CROSS_TRAINER: 'Cross Trainer',
  ELLIPTICAL: 'Elliptical',
  ROWING: 'Rowing',
  OTHER: 'Other',
};
const MODALITY_ORDER: CardioModality[] = ['TREADMILL', 'CYCLING', 'CROSS_TRAINER', 'ELLIPTICAL', 'ROWING', 'OTHER'];

/** Matches cardio exercise names (e.g. "Treadmill Running") to a modality so the form starts prefilled. */
function guessModality(name?: string): CardioModality {
  const n = (name ?? '').toLowerCase();
  if (n.includes('tread') || n.includes('run')) return 'TREADMILL';
  if (n.includes('cycl') || n.includes('bike') || n.includes('spin')) return 'CYCLING';
  if (n.includes('row')) return 'ROWING';
  if (n.includes('ellipt')) return 'ELLIPTICAL';
  if (n.includes('cross')) return 'CROSS_TRAINER';
  return 'OTHER';
}

interface Props {
  visible: boolean;
  /** yyyy-mm-dd the workout is being logged for. */
  date: string;
  /** Exercise name picked from the catalog, used only to guess the modality. */
  exerciseName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CardioLogModal({ visible, date, exerciseName, onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();

  const [modality, setModality] = useState<CardioModality>('OTHER');
  const [duration, setDuration] = useState('30');
  const [intensity, setIntensity] = useState('Zone 2');
  const [heartRate, setHeartRate] = useState('');
  // The modal stays mounted while `visible` toggles, so the modality guess is
  // (re)applied here — during render, not in an effect — each time it opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setModality(guessModality(exerciseName));
  }

  const reset = () => {
    setDuration('30');
    setIntensity('Zone 2');
    setHeartRate('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.createCardioEntry({
        date,
        modality,
        duration_minutes: Math.max(1, Math.round(parseNumberInput(duration) ?? 30)),
        intensity: intensity.trim() || 'Zone 2',
        heart_rate: heartRate ? Math.round(parseNumberInput(heartRate) ?? 0) : null,
        target_zone: '',
        completed: true,
      }),
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      reset();
      onSaved();
    },
    onError: () => haptics.error(),
  });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Log cardio
          </Text>
          <PressableScale haptic="selection" onPress={close} style={styles.closeBtn} accessibilityLabel="Close">
            <X size={20} color={colors.textPrimary} />
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {exerciseName ? <Text style={styles.exerciseName}>{exerciseName}</Text> : null}

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {MODALITY_ORDER.map((m) => (
              <PressableScale
                key={m}
                haptic="selection"
                onPress={() => setModality(m)}
                style={[styles.chip, modality === m && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: modality === m }}
              >
                <Text style={[styles.chipText, modality === m && styles.chipTextSelected]}>{MODALITY_LABELS[m]}</Text>
              </PressableScale>
            ))}
          </View>

          <Input
            label="Duration (minutes)"
            keyboardType="number-pad"
            value={duration}
            onChangeText={setDuration}
          />
          <Input label="Intensity" placeholder="e.g. Zone 2" value={intensity} onChangeText={setIntensity} />
          <Input
            label="Heart rate (optional)"
            keyboardType="number-pad"
            value={heartRate}
            onChangeText={setHeartRate}
          />

          {mutation.error ? <Text style={styles.error}>{extractErrorMessage(mutation.error)}</Text> : null}

          <Button title="Save" size="lg" loading={mutation.isPending} onPress={() => mutation.mutate()} style={styles.saveBtn} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    padding: spacing.lg,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primaryLight,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  saveBtn: {
    marginTop: spacing.md,
  },
}));
