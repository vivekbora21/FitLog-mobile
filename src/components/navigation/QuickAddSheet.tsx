import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Dumbbell, Utensils, ChevronRight } from 'lucide-react-native';
import { PressableScale } from '../ui/PressableScale';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { toDateKey } from '../../lib/format';

interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function QuickAddSheet({ visible, onClose }: QuickAddSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const todayKey = toDateKey(new Date());

  const handleLogWorkout = () => {
    onClose();
    router.push('/workout/log');
  };

  const handleAddMeal = () => {
    onClose();
    router.push({ pathname: '/meal/add', params: { date: todayKey } });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />
          <Text style={styles.title}>Quick add</Text>

          <PressableScale
            haptic="selection"
            onPress={handleLogWorkout}
            style={styles.row}
            accessibilityLabel="Log workout"
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySurface }]}>
              <Dumbbell size={20} color={colors.primaryLight} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Log workout</Text>
              <Text style={styles.rowSub}>Record sets, reps & weights</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </PressableScale>

          <PressableScale
            haptic="selection"
            onPress={handleAddMeal}
            style={styles.row}
            accessibilityLabel="Add meal"
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.cyanGlow }]}>
              <Utensils size={20} color={colors.cyan} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Add meal</Text>
              <Text style={styles.rowSub}>Log food & track macros</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </PressableScale>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl + spacing.lg,
    gap: spacing.sm,
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
}));
