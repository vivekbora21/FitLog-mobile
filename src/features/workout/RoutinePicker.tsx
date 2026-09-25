import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell, Calendar, History, X, ChevronRight, Sparkles, Check } from 'lucide-react-native';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PressableScale } from '../../components/ui/PressableScale';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { formatDuration, formatRelativeDay, formatVolume } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { WorkoutSession } from '../../types';

interface RoutinePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectRoutine: (routine: { id: string; name: string; exercises?: any[] }) => void;
  onSelectSession?: (session: WorkoutSession) => void;
  activeRoutineId?: string | null;
}

export function RoutinePicker({
  visible,
  onClose,
  onSelectRoutine,
  onSelectSession,
  activeRoutineId,
}: RoutinePickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [tab, setTab] = useState<'plan' | 'routines' | 'history'>('plan');

  const { data: planData, isLoading: isPlanLoading } = useQuery({
    queryKey: ['workoutPlan'],
    queryFn: () => api.getWorkoutPlan(),
    enabled: visible,
  });

  const { data: routinesData, isLoading: isRoutinesLoading } = useQuery({
    queryKey: ['routines'],
    queryFn: () => api.getRoutines(),
    enabled: visible,
  });

  const { data: sessionPages, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['workoutSessions'],
    queryFn: () => api.getWorkoutSessions(),
    enabled: visible && tab === 'history',
  });

  const planDays = planData?.days || [];
  const routines = routinesData || [];
  const recentSessions: WorkoutSession[] = (sessionPages || []).slice(0, 10);

  const handlePickRoutine = (routine: { id: string; name: string; exercises?: any[] }) => {
    haptics.success();
    onSelectRoutine(routine);
    onClose();
  };

  const handlePickSession = (session: WorkoutSession) => {
    haptics.success();
    if (onSelectSession) {
      onSelectSession(session);
    } else {
      onSelectRoutine({
        id: session.routine || '',
        name: session.title || 'Workout',
        exercises: session.exercises || [],
      });
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Load Workout Routine</Text>
              <Text style={styles.subtitle}>Choose a routine or copy from a past workout</Text>
            </View>
            <PressableScale haptic="selection" onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </PressableScale>
          </View>

          {/* Segment Tabs */}
          <View style={styles.tabsRow}>
            <PressableScale
              haptic="selection"
              onPress={() => setTab('plan')}
              style={[styles.tabBtn, tab === 'plan' && styles.tabBtnActive]}
            >
              <Calendar size={14} color={tab === 'plan' ? colors.primaryLight : colors.textMuted} />
              <Text style={[styles.tabText, tab === 'plan' && styles.tabTextActive]}>From Plan</Text>
            </PressableScale>

            <PressableScale
              haptic="selection"
              onPress={() => setTab('routines')}
              style={[styles.tabBtn, tab === 'routines' && styles.tabBtnActive]}
            >
              <Dumbbell size={14} color={tab === 'routines' ? colors.primaryLight : colors.textMuted} />
              <Text style={[styles.tabText, tab === 'routines' && styles.tabTextActive]}>All Routines</Text>
            </PressableScale>

            <PressableScale
              haptic="selection"
              onPress={() => setTab('history')}
              style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
            >
              <History size={14} color={tab === 'history' ? colors.primaryLight : colors.textMuted} />
              <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Recent</Text>
            </PressableScale>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {tab === 'plan' && (
              <>
                {isPlanLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginVertical: 24 }} />
                ) : planDays.length > 0 ? (
                  planDays.map((d) => {
                    const r = d.routine_details;
                    const exCount = r?.exercises?.length || 0;
                    const isSelected = activeRoutineId && r?.id === activeRoutineId;
                    return (
                      <PressableScale
                        key={d.id}
                        haptic="selection"
                        onPress={() => r && handlePickRoutine(r)}
                        style={[styles.routineRow, isSelected && styles.routineRowSelected]}
                      >
                        <View style={[styles.dayBadge, { backgroundColor: colors.primarySurface }]}>
                          <Text style={styles.dayBadgeText}>D{d.day_number}</Text>
                        </View>
                        <View style={styles.routineInfo}>
                          <Text style={styles.routineTitle} numberOfLines={1}>
                            {d.label || r?.name || `Day ${d.day_number}`}
                          </Text>
                          <Text style={styles.routineMeta}>
                            {exCount ? `${exCount} exercises` : 'Rest & Recovery'}
                            {d.is_optional ? ' · Optional' : ''}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View style={styles.activeCheck}>
                            <Check size={16} color={colors.primaryLight} strokeWidth={2.6} />
                          </View>
                        ) : (
                          <ChevronRight size={18} color={colors.textMuted} />
                        )}
                      </PressableScale>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No active plan enrolled.</Text>
                  </View>
                )}
              </>
            )}

            {tab === 'routines' && (
              <>
                {isRoutinesLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginVertical: 24 }} />
                ) : routines.length > 0 ? (
                  routines.map((r: any) => {
                    const exCount = r.exercises?.length || 0;
                    const isSelected = activeRoutineId && r.id === activeRoutineId;
                    return (
                      <PressableScale
                        key={r.id}
                        haptic="selection"
                        onPress={() => handlePickRoutine(r)}
                        style={[styles.routineRow, isSelected && styles.routineRowSelected]}
                      >
                        <View style={[styles.dayBadge, { backgroundColor: colors.canvas }]}>
                          <Dumbbell size={16} color={colors.textSecondary} />
                        </View>
                        <View style={styles.routineInfo}>
                          <Text style={styles.routineTitle} numberOfLines={1}>
                            {r.name}
                          </Text>
                          <Text style={styles.routineMeta}>{exCount} exercises</Text>
                        </View>
                        {isSelected ? (
                          <View style={styles.activeCheck}>
                            <Check size={16} color={colors.primaryLight} strokeWidth={2.6} />
                          </View>
                        ) : (
                          <ChevronRight size={18} color={colors.textMuted} />
                        )}
                      </PressableScale>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No routines found.</Text>
                  </View>
                )}
              </>
            )}

            {tab === 'history' && (
              <>
                {isSessionsLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginVertical: 24 }} />
                ) : recentSessions.length > 0 ? (
                  recentSessions.map((s) => {
                    const exCount = s.exercises?.length || 0;
                    return (
                      <PressableScale
                        key={s.id}
                        haptic="selection"
                        onPress={() => handlePickSession(s)}
                        style={styles.routineRow}
                      >
                        <View style={[styles.dayBadge, { backgroundColor: colors.cyanGlow }]}>
                          <History size={16} color={colors.cyan} />
                        </View>
                        <View style={styles.routineInfo}>
                          <Text style={styles.routineTitle} numberOfLines={1}>
                            {s.title || 'Workout Session'}
                          </Text>
                          <Text style={styles.routineMeta}>
                            {[
                              formatRelativeDay(s.started_at),
                              exCount ? `${exCount} exercises` : null,
                              formatVolume(s.total_volume_kg),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.textMuted} />
                      </PressableScale>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No recent workout sessions to copy.</Text>
                  </View>
                )}
              </>
            )}
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
    maxHeight: '80%',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
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
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
  },
  tabBtnActive: {
    backgroundColor: colors.primarySurface,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  routineRowSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  routineInfo: {
    flex: 1,
  },
  routineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  routineMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeCheck: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
}));
