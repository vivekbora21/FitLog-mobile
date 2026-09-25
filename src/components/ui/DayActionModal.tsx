import React from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Check,
  Moon,
  SkipForward,
  Dumbbell,
  Utensils,
  Clock,
  Layers,
  X,
  RotateCcw,
  ChevronRight,
  Flame,
} from 'lucide-react-native';
import { api, extractErrorMessage, type CalendarDayInfo, type DayStatus } from '../../api/client';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { PressableScale } from './PressableScale';
import { useToast } from './Toast';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { formatDayLabel, formatDuration, formatVolume, parseDateKey, toDateKey } from '../../lib/format';
import { invalidateTrackingData } from '../../lib/queries';
import { haptics } from '../../lib/haptics';

interface DayActionModalProps {
  visible: boolean;
  dateKey: string;
  dayInfo?: CalendarDayInfo | null;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export function DayActionModal({ visible, dateKey, dayInfo, onClose, onStatusUpdated }: DayActionModalProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const todayKey = toDateKey(new Date());
  const isToday = dateKey === todayKey;
  const parsedDate = parseDateKey(dateKey);
  const formattedFullDate = parsedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const relativeLabel = formatDayLabel(dateKey);

  const statusMutation = useMutation({
    mutationFn: (newStatus: 'COMPLETED' | 'REST' | 'SKIPPED' | 'CLEAR') =>
      api.updateCalendarDayStatus({ date: dateKey, status: newStatus }),
    onSuccess: async (_, newStatus) => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      onStatusUpdated?.();
      const labels: Record<string, string> = {
        COMPLETED: 'Marked as completed',
        REST: 'Marked as rest day',
        SKIPPED: 'Marked as skipped',
        CLEAR: 'Status cleared',
      };
      toast({ message: labels[newStatus] || 'Status updated' });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't update day status", extractErrorMessage(err));
    },
  });

  const currentStatus: DayStatus = dayInfo?.status || 'UPCOMING';
  const hasWorkout = !!dayInfo?.has_workout;
  const programDay = dayInfo?.program_day;

  const handleSetStatus = (s: 'COMPLETED' | 'REST' | 'SKIPPED' | 'CLEAR') => {
    haptics.selection();
    statusMutation.mutate(s);
  };

  const handleStartWorkout = () => {
    onClose();
    router.push({
      pathname: '/workout/log',
      params: {
        date: dateKey,
        plan: programDay ? '1' : undefined,
        routineId: programDay?.routine_id || undefined,
      },
    });
  };

  const handleOpenNutrition = () => {
    onClose();
    router.navigate({
      pathname: '/(tabs)/nutrition',
      params: { date: dateKey },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.sheetTitle}>
                  {programDay ? `Day ${programDay.day_number} · ` : ''}{formattedFullDate}
                </Text>
                {isToday && (
                  <View style={styles.todayPill}>
                    <Text style={styles.todayPillText}>TODAY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sheetSubtitle}>
                {relativeLabel}
                {programDay?.label ? ` · ${programDay.label}` : ''}
              </Text>
            </View>
            <PressableScale
              haptic="selection"
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close day options"
            >
              <X size={20} color={colors.textSecondary} />
            </PressableScale>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Status Summary Banner */}
            <View
              style={[
                styles.statusBanner,
                currentStatus === 'COMPLETED' && styles.statusBannerCompleted,
                currentStatus === 'REST' && styles.statusBannerRest,
                currentStatus === 'SKIPPED' && styles.statusBannerSkipped,
              ]}
            >
              <View style={styles.statusBannerIconCol}>
                {currentStatus === 'COMPLETED' && <Check size={20} color="#10B981" strokeWidth={2.6} />}
                {currentStatus === 'REST' && <Moon size={20} color={colors.cyan} strokeWidth={2.4} />}
                {currentStatus === 'SKIPPED' && <SkipForward size={20} color={colors.amber} strokeWidth={2.4} />}
                {currentStatus === 'UPCOMING' && <Clock size={20} color={colors.textMuted} />}
              </View>
              <View style={styles.statusBannerTextCol}>
                <Text style={styles.statusBannerTitle}>
                  {currentStatus === 'COMPLETED' && (hasWorkout ? 'Workout Completed' : 'Marked Completed')}
                  {currentStatus === 'REST' && 'Rest & Recovery Day'}
                  {currentStatus === 'SKIPPED' && 'Skipped Day'}
                  {currentStatus === 'UPCOMING' && (programDay ? `Scheduled: ${programDay.label}` : 'Open Day')}
                </Text>
                <Text style={styles.statusBannerDesc}>
                  {currentStatus === 'COMPLETED' &&
                    (dayInfo?.workout_title
                      ? `${dayInfo.workout_title} · ${dayInfo.duration_min}m`
                      : 'Session completed for this day')}
                  {currentStatus === 'REST' && (dayInfo?.notes || 'Full recovery, mobility, sleep and hydration.')}
                  {currentStatus === 'SKIPPED' && (dayInfo?.notes || 'Scheduled workout was skipped.')}
                  {currentStatus === 'UPCOMING' &&
                    (programDay ? 'Ready to train when you are.' : 'No activity logged yet.')}
                </Text>
              </View>
              {statusMutation.isPending && <ActivityIndicator size="small" color={colors.primaryLight} />}
            </View>

            {/* Set Day Status Section */}
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>MARK STATUS</Text>
              <View style={styles.statusGrid}>
                {/* Completed */}
                <PressableScale
                  haptic="selection"
                  onPress={() => handleSetStatus('COMPLETED')}
                  style={[
                    styles.statusOption,
                    currentStatus === 'COMPLETED' && styles.statusOptionActiveCompleted,
                  ]}
                  accessibilityLabel="Mark day as Completed"
                >
                  <View style={[styles.statusOptionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Check size={18} color="#10B981" strokeWidth={2.6} />
                  </View>
                  <Text style={[styles.statusOptionLabel, currentStatus === 'COMPLETED' && styles.statusOptionLabelActive]}>
                    Completed
                  </Text>
                </PressableScale>

                {/* Rest Day */}
                <PressableScale
                  haptic="selection"
                  onPress={() => handleSetStatus('REST')}
                  style={[
                    styles.statusOption,
                    currentStatus === 'REST' && styles.statusOptionActiveRest,
                  ]}
                  accessibilityLabel="Mark day as Rest Day"
                >
                  <View style={[styles.statusOptionIconCircle, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                    <Moon size={18} color={colors.cyan} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.statusOptionLabel, currentStatus === 'REST' && styles.statusOptionLabelActive]}>
                    Rest Day
                  </Text>
                </PressableScale>

                {/* Skipped */}
                <PressableScale
                  haptic="selection"
                  onPress={() => handleSetStatus('SKIPPED')}
                  style={[
                    styles.statusOption,
                    currentStatus === 'SKIPPED' && styles.statusOptionActiveSkipped,
                  ]}
                  accessibilityLabel="Mark day as Skipped"
                >
                  <View style={[styles.statusOptionIconCircle, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
                    <SkipForward size={18} color={colors.amber} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.statusOptionLabel, currentStatus === 'SKIPPED' && styles.statusOptionLabelActive]}>
                    Skipped
                  </Text>
                </PressableScale>
              </View>

              {currentStatus !== 'UPCOMING' && (
                <PressableScale
                  haptic="selection"
                  onPress={() => handleSetStatus('CLEAR')}
                  style={styles.clearBtn}
                  accessibilityLabel="Clear status"
                >
                  <RotateCcw size={14} color={colors.textMuted} />
                  <Text style={styles.clearBtnText}>Reset to open day</Text>
                </PressableScale>
              )}
            </View>

            {/* Workout Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>WORKOUT</Text>
              {hasWorkout ? (
                <Card elevated style={styles.workoutCard}>
                  <View style={styles.workoutCardRow}>
                    <View style={[styles.workoutIconCircle, { backgroundColor: colors.primarySurface }]}>
                      <Dumbbell size={20} color={colors.primaryLight} />
                    </View>
                    <View style={styles.workoutCardInfo}>
                      <Text style={styles.workoutCardTitle} numberOfLines={1}>
                        {dayInfo?.workout_title || 'Workout Session'}
                      </Text>
                      <View style={styles.workoutStatsRow}>
                        {dayInfo?.duration_min ? (
                          <View style={styles.workoutStatItem}>
                            <Clock size={12} color={colors.textMuted} />
                            <Text style={styles.workoutStatText}>{dayInfo.duration_min}m</Text>
                          </View>
                        ) : null}
                        {dayInfo?.volume_kg ? (
                          <View style={styles.workoutStatItem}>
                            <Layers size={12} color={colors.textMuted} />
                            <Text style={styles.workoutStatText}>{formatVolume(dayInfo.volume_kg)}</Text>
                          </View>
                        ) : null}
                        {dayInfo?.exercises_count ? (
                          <View style={styles.workoutStatItem}>
                            <Text style={styles.workoutStatText}>{dayInfo.exercises_count} exercises</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.workoutActionRow}>
                    <Button
                      title="Log another workout"
                      size="sm"
                      variant="secondary"
                      icon={<Dumbbell size={16} color={colors.textPrimary} />}
                      iconPosition="left"
                      onPress={handleStartWorkout}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ) : (
                <Card elevated style={styles.emptyWorkoutCard}>
                  <View style={styles.emptyWorkoutHeader}>
                    <View style={[styles.workoutIconCircle, { backgroundColor: colors.canvas }]}>
                      <Dumbbell size={20} color={colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emptyWorkoutTitle}>
                        {programDay ? programDay.label : 'No workout logged'}
                      </Text>
                      <Text style={styles.emptyWorkoutDesc}>
                        {programDay
                          ? 'Scheduled routine is ready to log.'
                          : 'Log exercises, sets, weights and reps for this date.'}
                      </Text>
                    </View>
                  </View>
                  <Button
                    title={`Log workout for ${relativeLabel.toLowerCase() === 'today' || relativeLabel.toLowerCase() === 'yesterday' ? relativeLabel : formattedFullDate}`}
                    icon={<Dumbbell size={18} color="#FFFFFF" />}
                    iconPosition="left"
                    onPress={handleStartWorkout}
                    style={styles.primaryLogBtn}
                  />
                </Card>
              )}
            </View>

            {/* Nutrition / Other Sections */}
            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>NUTRITION</Text>
              <PressableScale
                haptic="selection"
                onPress={handleOpenNutrition}
                style={styles.nutritionRow}
                accessibilityLabel="Open nutrition details for this date"
              >
                <View style={[styles.workoutIconCircle, { backgroundColor: colors.cyanGlow }]}>
                  <Utensils size={18} color={colors.cyan} />
                </View>
                <View style={styles.nutritionTextCol}>
                  <Text style={styles.nutritionTitle}>View nutrition & meals</Text>
                  <Text style={styles.nutritionSub}>Calories, macros & water logged on {relativeLabel}</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </PressableScale>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    paddingBottom: spacing.xl,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderBright,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  todayPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  statusBannerCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBannerRest: {
    backgroundColor: 'rgba(2, 132, 199, 0.10)',
    borderColor: 'rgba(2, 132, 199, 0.3)',
  },
  statusBannerSkipped: {
    backgroundColor: 'rgba(217, 119, 6, 0.10)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  statusBannerIconCol: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerTextCol: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBannerDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    gap: spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusOptionActiveCompleted: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  statusOptionActiveRest: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
  },
  statusOptionActiveSkipped: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  statusOptionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusOptionLabelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  clearBtnText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  workoutCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  workoutCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workoutIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutCardInfo: {
    flex: 1,
  },
  workoutCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 4,
  },
  workoutStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutStatText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  workoutActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyWorkoutCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  emptyWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyWorkoutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyWorkoutDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  primaryLogBtn: {
    marginTop: spacing.xs,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  nutritionTextCol: {
    flex: 1,
  },
  nutritionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nutritionSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
}));
