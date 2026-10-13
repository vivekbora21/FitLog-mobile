import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2, CloudOff, RefreshCw, Trash2 } from 'lucide-react-native';
import { Badge, Button, Card, PressableScale, SheetScreen } from '../../src/components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../src/theme';
import {
  getQueueSnapshot,
  processQueue,
  removeOperation,
  retryOperation,
  type QueuedOperation,
} from '../../src/lib/offlineQueue';
import { haptics } from '../../src/lib/haptics';

const TYPE_LABEL: Record<QueuedOperation['type'], string> = {
  workout: 'Workout',
  meal: 'Meal',
  weight: 'Weigh-in',
};

/** Lets a person see — and recover from — writes that couldn't reach the server yet
 * (BUG-11): what's still queued, what's actively retrying, and what needs their
 * attention because it failed in a way retrying won't fix on its own. */
export default function SyncStatusScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [items, setItems] = useState<QueuedOperation[]>([]);

  const refresh = useCallback(() => setItems(getQueueSnapshot()), []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      void processQueue().then(refresh);
      // Background syncs can resolve items while this screen is open; a light poll is
      // the simplest way to reflect that without a dedicated event-emitter in the queue.
      const interval = setInterval(refresh, 3000);
      return () => clearInterval(interval);
    }, [refresh])
  );

  const failed = items.filter((i) => i.status === 'failed');
  const pending = items.filter((i) => i.status !== 'failed');

  const confirmDiscard = (item: QueuedOperation) => {
    Alert.alert(
      `Discard this ${TYPE_LABEL[item.type].toLowerCase()}?`,
      'It was never saved to the server and this removes it from this device too. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            removeOperation(item.id);
            haptics.warning();
            refresh();
          },
        },
      ]
    );
  };

  return (
    <SheetScreen title="Sync status" onClose={() => router.back()}>
      <View style={styles.container}>
        {items.length === 0 && (
          <Card style={styles.emptyCard}>
            <CheckCircle2 size={28} color={colors.success} />
            <Text style={styles.emptyTitle}>Everything&apos;s synced</Text>
            <Text style={styles.emptySubtitle}>No workouts, meals, or weigh-ins are waiting to reach the server.</Text>
          </Card>
        )}

        {failed.length > 0 && (
          <>
            <Text style={styles.groupLabel}>Needs your attention</Text>
            {failed.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Badge label={TYPE_LABEL[item.type]} tone="rose" />
                  <Text style={styles.itemLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
                {item.lastError && <Text style={styles.errorText}>{item.lastError}</Text>}
                <View style={styles.itemActions}>
                  <PressableScale
                    style={styles.actionBtn}
                    onPress={() => {
                      retryOperation(item.id);
                      refresh();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Retry"
                  >
                    <RefreshCw size={14} color={colors.primaryLight} />
                    <Text style={styles.actionText}>Retry</Text>
                  </PressableScale>
                  <PressableScale
                    style={styles.actionBtn}
                    onPress={() => confirmDiscard(item)}
                    accessibilityRole="button"
                    accessibilityLabel="Discard"
                  >
                    <Trash2 size={14} color={colors.error} />
                    <Text style={[styles.actionText, { color: colors.error }]}>Discard</Text>
                  </PressableScale>
                </View>
              </Card>
            ))}
          </>
        )}

        {pending.length > 0 && (
          <>
            <Text style={styles.groupLabel}>Waiting to sync</Text>
            {pending.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Badge label={TYPE_LABEL[item.type]} tone={item.status === 'syncing' ? 'cyan' : 'amber'} />
                  <Text style={styles.itemLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
                <View style={styles.pendingRow}>
                  <CloudOff size={14} color={colors.textSecondary} />
                  <Text style={styles.pendingText}>
                    {item.status === 'syncing' ? 'Syncing…' : item.attempts > 0 ? `Saved on this device — retrying` : 'Saved on this device — will sync once online'}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        )}

        {failed.length > 0 && (
          <Button
            title="Retry all"
            variant="secondary"
            onPress={() => {
              failed.forEach((item) => retryOperation(item.id));
              refresh();
            }}
            style={styles.retryAllBtn}
          />
        )}
      </View>
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.sm,
  },
  itemCard: {
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHover,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  retryAllBtn: {
    marginTop: spacing.sm,
  },
}));
