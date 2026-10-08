import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { BookOpen, ChevronDown, Dumbbell, Play, Target, Zap } from 'lucide-react-native';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { PressableScale } from '../../components/ui';

export interface ExerciseGuide {
  name: string;
  muscle?: string;
  equipment?: string;
  instructions?: string;
  videoUrl?: string | null;
  targetRpe?: number | null;
  targetReps?: string;
  targetSets?: number;
}

interface Props {
  visible: boolean;
  guide: ExerciseGuide | null;
  onClose: () => void;
}

const RPE_LABELS: Record<number, string> = {
  6: 'Very light — just warming up',
  7: 'Light — comfortable pace',
  8: 'Moderate — slightly challenging',
  9: 'Hard — 1–2 reps left in tank',
  10: 'Max effort — nothing left',
};

function rpeDescription(rpe: number): string {
  const floored = Math.floor(rpe);
  return RPE_LABELS[floored] ?? (rpe < 7 ? 'Very light effort' : 'Near-maximal effort');
}

function parseInstructionSteps(instructions: string): string[] {
  const byNumber = instructions.split(/\n?(\d+)\.\s+/).filter((s) => s && !/^\d+$/.test(s.trim()));
  if (byNumber.length > 1) return byNumber.map((s) => s.trim()).filter(Boolean);
  return instructions.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

export function ExerciseGuideModal({ visible, guide, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  if (!guide) return null;

  const steps = guide.instructions ? parseInstructionSteps(guide.instructions) : [];
  const hasVideo = !!guide.videoUrl;

  const openVideo = () => {
    if (guide.videoUrl) {
      Linking.openURL(guide.videoUrl).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <BookOpen size={18} color={colors.primaryLight} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={2}>{guide.name}</Text>
              {guide.muscle ? (
                <Text style={styles.subtitle}>{guide.muscle}</Text>
              ) : null}
            </View>
            <PressableScale haptic="selection" onPress={onClose} style={styles.closeBtn}>
              <ChevronDown size={20} color={colors.textSecondary} />
            </PressableScale>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Prescription pill row */}
            {(guide.targetSets || guide.targetReps || guide.targetRpe) ? (
              <View style={styles.pillRow}>
                {guide.targetSets ? (
                  <View style={styles.pill}>
                    <Dumbbell size={12} color={colors.primaryLight} />
                    <Text style={styles.pillText}>{guide.targetSets} sets</Text>
                  </View>
                ) : null}
                {guide.targetReps ? (
                  <View style={styles.pill}>
                    <Zap size={12} color={colors.amber} />
                    <Text style={[styles.pillText, { color: colors.amber }]}>{guide.targetReps} reps</Text>
                  </View>
                ) : null}
                {guide.targetRpe ? (
                  <View style={[styles.pill, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                    <Target size={12} color={colors.violet} />
                    <Text style={[styles.pillText, { color: colors.violet }]}>RPE {guide.targetRpe}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* RPE explanation block */}
            {guide.targetRpe ? (
              <View style={styles.rpeCard}>
                <Text style={styles.sectionLabel}>Target Effort</Text>
                <View style={styles.rpeRow}>
                  <View style={styles.rpeMeter}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.rpeBar,
                          {
                            backgroundColor:
                              i < Math.round(guide.targetRpe ?? 0)
                                ? i < 6
                                  ? colors.success
                                  : i < 8
                                  ? colors.amber
                                  : colors.rose
                                : colors.track,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.rpeValue}>RPE {guide.targetRpe}</Text>
                </View>
                <Text style={styles.rpeLabel}>{rpeDescription(guide.targetRpe)}</Text>
                <Text style={styles.rirHint}>
                  ≈ RIR {Math.max(0, 10 - Math.round(guide.targetRpe))} — leave{' '}
                  {Math.max(0, 10 - Math.round(guide.targetRpe))} rep(s) in reserve
                </Text>
              </View>
            ) : null}

            {/* Equipment */}
            {guide.equipment ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Equipment</Text>
                <View style={styles.equipRow}>
                  <Dumbbell size={14} color={colors.textSecondary} />
                  <Text style={styles.equipText}>{guide.equipment}</Text>
                </View>
              </View>
            ) : null}

            {/* Instructions */}
            {steps.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>How to perform</Text>
                {steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noInstructions}>
                <Text style={styles.noInstructionsText}>
                  No step-by-step guide for this exercise yet. Ask your trainer for form cues!
                </Text>
              </View>
            )}

            {/* Video button */}
            {hasVideo ? (
              <PressableScale haptic="medium" onPress={openVideo} style={styles.videoBtn}>
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.videoBtnText}>Watch Form Video</Text>
              </PressableScale>
            ) : null}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },

  rpeCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rpeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  rpeMeter: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 8,
  },
  rpeBar: {
    flex: 1,
    borderRadius: 4,
  },
  rpeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.violet,
    minWidth: 52,
    textAlign: 'right',
  },
  rpeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rirHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  section: { marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  equipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    fontWeight: '500',
  },

  noInstructions: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noInstructionsText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  videoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  videoBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
}));
