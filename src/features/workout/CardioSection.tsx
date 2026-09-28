import React, { useMemo, useState } from 'react';
import { View, Text, Alert, LayoutChangeEvent } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { HeartPulse, Calendar, Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PressableScale } from '../../components/ui/PressableScale';
import { radius, spacing, makeStyles, useTheme } from '../../theme';
import { formatDayLabel } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { CardioEntry } from '../../types';

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(400);
const HISTORY_PAGE_SIZE = 5;

export function CardioSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const {
    data: cardioEntries = [],
    isLoading,
  } = useQuery({
    queryKey: ['cardioEntries'],
    queryFn: () => api.getCardioEntries(),
  });

  const deleteCardioMutation = useMutation({
    mutationFn: (id: string) => api.deleteCardioEntry(id),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['cardioEntries'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't delete cardio entry", extractErrorMessage(err));
    },
  });

  const confirmDeleteCardio = (id: string, label: string) => {
    haptics.warning();
    Alert.alert('Delete cardio session?', `Remove the entry for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteCardioMutation.mutate(id),
      },
    ]);
  };

  // Sorted Cardio: Oldest to newest for trend chart, newest to oldest for history list
  const chronologicalCardio = useMemo(() => {
    return [...cardioEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [cardioEntries]);

  const recentCardio = useMemo(() => {
    return [...cardioEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [cardioEntries]);

  const totalMinutes = useMemo(
    () => cardioEntries.filter((c) => c.completed).reduce((sum, c) => sum + c.duration_minutes, 0),
    [cardioEntries]
  );

  const completedCount = chronologicalCardio.filter((c) => c.completed).length;
  const avgMinutes = completedCount > 0 ? Math.round(totalMinutes / completedCount) : null;
  const visibleHistory = showAllHistory ? recentCardio : recentCardio.slice(0, HISTORY_PAGE_SIZE);

  if (isLoading) return null;

  return (
    <View style={styles.sectionWrap}>
      {/* Collapsible header */}
      <PressableScale
        haptic="selection"
        onPress={() => setExpanded((v) => !v)}
        style={styles.toggleRow}
        accessibilityLabel={expanded ? 'Collapse cardio' : 'Expand cardio'}
      >
        <View style={styles.toggleIconBox}>
          <HeartPulse size={18} color={colors.primaryLight} />
        </View>
        <View style={styles.toggleTextCol}>
          <Text style={styles.toggleTitle}>Cardio</Text>
          <Text style={styles.toggleMeta}>
            {completedCount} session{completedCount === 1 ? '' : 's'} · {totalMinutes} min total
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={18} color={colors.textMuted} />
        ) : (
          <ChevronDown size={18} color={colors.textMuted} />
        )}
      </PressableScale>

      {!expanded ? null : (
        <>
      {/* KPI Cards Row */}
      <Animated.View entering={enter(0)} style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Time</Text>
          <Text style={styles.kpiValue}>
            {totalMinutes}
            <Text style={styles.kpiUnit}> min</Text>
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Sessions</Text>
          <Text style={styles.kpiValue}>{completedCount}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Avg Duration</Text>
          <Text style={styles.kpiValue}>
            {avgMinutes != null ? avgMinutes : '--'}
            <Text style={styles.kpiUnit}> min</Text>
          </Text>
        </View>
      </Animated.View>

      {/* Trend Chart Card */}
      <Animated.View entering={enter(1)}>
        <Card elevated style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Conditioning Trend</Text>
              <Text style={styles.cardTitle}>Cardio Minutes Over Time</Text>
            </View>
            <Badge
              label={`${chronologicalCardio.length} session${
                chronologicalCardio.length === 1 ? '' : 's'
              }`}
              tone="cyan"
            />
          </View>

          {chronologicalCardio.length >= 1 ? (
            <CardioSvgChart entries={chronologicalCardio} />
          ) : (
            <View style={styles.emptyChartBox}>
              <HeartPulse size={28} color={colors.textMuted} />
              <Text style={styles.emptyChartText}>
                Log a cardio session to render the trend chart.
              </Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Cardio History List */}
      <Animated.View entering={enter(2)} style={styles.historyWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Cardio History</Text>
        </View>

        {recentCardio.length === 0 ? (
          <EmptyState
            icon={<HeartPulse size={26} color={colors.primaryLight} />}
            title="No cardio sessions yet"
            description="Log a treadmill, cycling, or rowing session to see it here."
          />
        ) : (
          <>
            <View style={styles.historyList}>
              {visibleHistory.map((c) => (
                <View key={c.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyDateBox}>
                      <Calendar size={14} color={colors.primaryLight} />
                      <Text style={styles.historyDate}>{formatDayLabel(c.date)}</Text>
                    </View>
                    <Text style={styles.historyIsoDate}>
                      {c.modality} · {c.intensity}
                    </Text>
                  </View>

                  <View style={styles.historyRight}>
                    <View style={styles.historyWeightCol}>
                      <Text style={styles.historyWeightVal}>
                        {c.duration_minutes} <Text style={styles.historyWeightUnit}>min</Text>
                      </Text>
                      {c.heart_rate != null && (
                        <Text style={styles.historyDiff}>{c.heart_rate} bpm</Text>
                      )}
                    </View>

                    <PressableScale
                      haptic="medium"
                      onPress={() => confirmDeleteCardio(c.id, `${c.modality} on ${c.date}`)}
                      style={styles.historyDeleteBtn}
                      accessibilityLabel="Delete entry"
                    >
                      <Trash2 size={16} color={colors.textMuted} />
                    </PressableScale>
                  </View>
                </View>
              ))}
            </View>

            {recentCardio.length > HISTORY_PAGE_SIZE && (
              <PressableScale
                haptic="selection"
                onPress={() => setShowAllHistory((v) => !v)}
                style={styles.showMoreBtn}
                accessibilityLabel={showAllHistory ? 'Show fewer sessions' : 'Show all sessions'}
              >
                <Text style={styles.showMoreText}>
                  {showAllHistory ? 'Show less' : `Show all ${recentCardio.length} sessions`}
                </Text>
                {showAllHistory ? (
                  <ChevronUp size={16} color={colors.primaryLight} />
                ) : (
                  <ChevronDown size={16} color={colors.primaryLight} />
                )}
              </PressableScale>
            )}
          </>
        )}
      </Animated.View>
        </>
      )}
    </View>
  );
}

function CardioSvgChart({ entries }: { entries: CardioEntry[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [layoutWidth, setLayoutWidth] = useState(320);
  const chartHeight = 180;
  const paddingHoriz = 24;
  const paddingTop = 20;
  const paddingBottom = 30;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50) setLayoutWidth(w);
  };

  const maxVal = Math.max(...entries.map((c) => c.duration_minutes), 1);
  const innerW = layoutWidth - paddingHoriz * 2;
  const innerH = chartHeight - paddingTop - paddingBottom;
  const barSlot = innerW / entries.length;
  const barWidth = Math.min(28, barSlot * 0.6);

  return (
    <View onLayout={onLayout} style={styles.chartContainer}>
      <Svg width={layoutWidth} height={chartHeight}>
        <Line
          x1={paddingHoriz}
          y1={chartHeight - paddingBottom}
          x2={layoutWidth - paddingHoriz}
          y2={chartHeight - paddingBottom}
          stroke={colors.borderSubtle}
        />

        {entries.map((c, idx) => {
          const barH = (c.duration_minutes / maxVal) * innerH;
          const x = paddingHoriz + idx * barSlot + (barSlot - barWidth) / 2;
          const y = chartHeight - paddingBottom - barH;
          return (
            <React.Fragment key={c.id}>
              <Path
                d={`M ${x},${chartHeight - paddingBottom} L ${x},${y} L ${x + barWidth},${y} L ${x + barWidth},${chartHeight - paddingBottom} Z`}
                fill={c.completed ? colors.primaryLight : colors.textMuted}
                opacity={c.completed ? 0.85 : 0.35}
              />
            </React.Fragment>
          );
        })}

        <SvgText
          x={paddingHoriz}
          y={chartHeight - 10}
          fill={colors.textMuted}
          fontSize="10"
          fontWeight="600"
        >
          {entries[0]?.date.slice(5)}
        </SvgText>
        <SvgText
          x={layoutWidth - paddingHoriz}
          y={chartHeight - 10}
          fill={colors.textMuted}
          fontSize="10"
          fontWeight="600"
          textAnchor="end"
        >
          {entries[entries.length - 1]?.date.slice(5)}
        </SvgText>
        <SvgText
          x={layoutWidth - paddingHoriz + 2}
          y={paddingTop + 4}
          fill={colors.textMuted}
          fontSize="9"
          textAnchor="end"
        >
          {Math.round(maxVal)}min
        </SvgText>
      </Svg>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  sectionWrap: {
    gap: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  toggleIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  toggleMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  kpiUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chartCard: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  emptyChartBox: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyChartText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  historyWrap: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  historyList: {
    gap: spacing.xs,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyLeft: {
    gap: 2,
  },
  historyDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyIsoDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyWeightCol: {
    alignItems: 'flex-end',
  },
  historyWeightVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  historyWeightUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  historyDiff: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyDeleteBtn: {
    padding: spacing.xs,
  },
}));
