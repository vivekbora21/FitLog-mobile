import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import {
  Scale,
  Trophy,
  Ruler,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Trash2,
  Search,
  Calendar,
  X,
} from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PressableScale,
  ScreenHeader,
} from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { colors, radius, spacing, shadows } from '../../src/theme';
import { formatDayLabel, parseNumberInput, toDateKey } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useAuth } from '../../src/providers/auth';
import type { BodyMeasurement, PersonalRecord, WeightEntry } from '../../src/types';

type TabKey = 'WEIGHT' | 'PRS' | 'MEASUREMENTS';

const TABS: { key: TabKey; label: string; icon: typeof Scale }[] = [
  { key: 'WEIGHT', label: 'Weight', icon: Scale },
  { key: 'PRS', label: 'PR Records', icon: Trophy },
  { key: 'MEASUREMENTS', label: 'Measurements', icon: Ruler },
];

const MUSCLE_FILTERS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(400);

export default function ProgressScreen() {
  const bottomClearance = useTabBarClearance();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('WEIGHT');

  // Queries
  const {
    data: weights = [],
    isLoading: isWeightsLoading,
    isRefetching: isWeightsRefetching,
    refetch: refetchWeights,
  } = useQuery({
    queryKey: ['weights'],
    queryFn: () => api.getWeights(),
  });

  const {
    data: prs = [],
    isLoading: isPrsLoading,
    isRefetching: isPrsRefetching,
    refetch: refetchPrs,
  } = useQuery({
    queryKey: ['personalRecords'],
    queryFn: () => api.getPersonalRecords(),
  });

  const {
    data: measurements = [],
    isLoading: isMeasurementsLoading,
    isRefetching: isMeasurementsRefetching,
    refetch: refetchMeasurements,
  } = useQuery({
    queryKey: ['bodyMeasurements'],
    queryFn: () => api.getBodyMeasurements(),
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
  });

  const isRefreshing = isWeightsRefetching || isPrsRefetching || isMeasurementsRefetching;
  const onRefresh = async () => {
    haptics.light();
    await Promise.all([refetchWeights(), refetchPrs(), refetchMeasurements()]);
  };

  // Weight Logging State
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [weightDate, setWeightDate] = useState(() => toDateKey(new Date()));

  const logWeightMutation = useMutation({
    mutationFn: async () => {
      const val = parseNumberInput(newWeight);
      if (!val || val <= 0 || val > 400) {
        throw new Error('Please enter a valid weight between 30 and 400 kg.');
      }
      await api.logWeight(weightDate, val);
    },
    onSuccess: () => {
      haptics.success();
      setNewWeight('');
      setIsLoggingWeight(false);
      queryClient.invalidateQueries({ queryKey: ['weights'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save weight", extractErrorMessage(err));
    },
  });

  const deleteWeightMutation = useMutation({
    mutationFn: (id: string) => api.deleteWeight(id),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['weights'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't delete weight entry", extractErrorMessage(err));
    },
  });

  const confirmDeleteWeight = (id: string, label: string) => {
    haptics.warning();
    Alert.alert('Delete weigh-in?', `Remove the entry for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteWeightMutation.mutate(id),
      },
    ]);
  };

  // PR Filters
  const [prSearch, setPrSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');

  const filteredPrs = useMemo(() => {
    return prs.filter((item) => {
      const matchSearch =
        !prSearch.trim() ||
        item.exercise_name?.toLowerCase().includes(prSearch.toLowerCase()) ||
        item.primary_muscle?.toLowerCase().includes(prSearch.toLowerCase());
      const matchMuscle =
        selectedMuscle === 'All' ||
        item.primary_muscle?.toLowerCase().includes(selectedMuscle.toLowerCase());
      return matchSearch && matchMuscle;
    });
  }, [prs, prSearch, selectedMuscle]);

  // Measurements Logging State
  const [isLoggingMeasurement, setIsLoggingMeasurement] = useState(false);
  const [mDate, setMDate] = useState(() => toDateKey(new Date()));
  const [mWaist, setMWaist] = useState('');
  const [mChest, setMChest] = useState('');
  const [mArms, setMArms] = useState('');
  const [mHips, setMHips] = useState('');
  const [mThighs, setMThighs] = useState('');
  const [mNotes, setMNotes] = useState('');

  const logMeasurementMutation = useMutation({
    mutationFn: async () => {
      await api.logBodyMeasurement({
        date: mDate,
        waist_cm: parseNumberInput(mWaist),
        chest_cm: parseNumberInput(mChest),
        arms_cm: parseNumberInput(mArms),
        hips_cm: parseNumberInput(mHips),
        thighs_cm: parseNumberInput(mThighs),
        notes: mNotes.trim(),
      });
    },
    onSuccess: () => {
      haptics.success();
      setIsLoggingMeasurement(false);
      setMWaist('');
      setMChest('');
      setMArms('');
      setMHips('');
      setMThighs('');
      setMNotes('');
      queryClient.invalidateQueries({ queryKey: ['bodyMeasurements'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save measurements", extractErrorMessage(err));
    },
  });

  const deleteMeasurementMutation = useMutation({
    mutationFn: (id: string) => api.deleteBodyMeasurement(id),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['bodyMeasurements'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't delete entry", extractErrorMessage(err));
    },
  });

  // Sorted Weights: Oldest to newest for trajectory chart, newest to oldest for history list
  const chronologicalWeights = useMemo(() => {
    return [...weights].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [weights]);

  const recentWeights = useMemo(() => {
    return [...weights].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [weights]);

  // Target and stats
  const currentWeight = recentWeights[0]?.weight_kg ?? user?.profile?.weight_kg ?? null;
  const startWeight = chronologicalWeights[0]?.weight_kg ?? null;
  const targetWeight =
    dashboardStats?.journey?.target_weight ||
    dashboardStats?.journey_pacing?.target_weight ||
    null;

  const weightDelta =
    currentWeight && startWeight && chronologicalWeights.length > 1
      ? Math.round((currentWeight - startWeight) * 10) / 10
      : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
            colors={[colors.primaryLight]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScreenHeader
          eyebrow="Analytics & History"
          title="Progress"
          right={
            <PressableScale
              haptic="selection"
              onPress={() => {
                if (activeTab === 'MEASUREMENTS') {
                  setIsLoggingMeasurement((v) => !v);
                } else {
                  setIsLoggingWeight((v) => !v);
                }
              }}
              style={styles.headerAddBtn}
              accessibilityLabel={activeTab === 'MEASUREMENTS' ? 'Log measurement' : 'Log weight'}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
            </PressableScale>
          }
        />

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <PressableScale
                key={tab.key}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(tab.key);
                }}
                style={[styles.tabItem, active && styles.tabItemActive]}
              >
                <Icon
                  size={16}
                  color={active ? colors.primaryLight : colors.textMuted}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {activeTab === 'WEIGHT' && (
          <WeightSection
            chronologicalWeights={chronologicalWeights}
            recentWeights={recentWeights}
            currentWeight={currentWeight}
            startWeight={startWeight}
            targetWeight={targetWeight}
            weightDelta={weightDelta}
            isLogging={isLoggingWeight}
            setIsLogging={setIsLoggingWeight}
            newWeight={newWeight}
            setNewWeight={setNewWeight}
            weightDate={weightDate}
            setWeightDate={setWeightDate}
            onSave={() => logWeightMutation.mutate()}
            isSaving={logWeightMutation.isPending}
            onDelete={confirmDeleteWeight}
            isLoading={isWeightsLoading}
          />
        )}

        {activeTab === 'PRS' && (
          <PrsSection
            prs={filteredPrs}
            allPrsCount={prs.length}
            search={prSearch}
            setSearch={setPrSearch}
            selectedMuscle={selectedMuscle}
            setSelectedMuscle={setSelectedMuscle}
            isLoading={isPrsLoading}
          />
        )}

        {activeTab === 'MEASUREMENTS' && (
          <MeasurementsSection
            measurements={measurements}
            isLogging={isLoggingMeasurement}
            setIsLogging={setIsLoggingMeasurement}
            date={mDate}
            setDate={setMDate}
            waist={mWaist}
            setWaist={setMWaist}
            chest={mChest}
            setChest={setMChest}
            arms={mArms}
            setArms={setMArms}
            hips={mHips}
            setHips={setMHips}
            thighs={mThighs}
            setThighs={setMThighs}
            notes={mNotes}
            setNotes={setMNotes}
            onSave={() => logMeasurementMutation.mutate()}
            isSaving={logMeasurementMutation.isPending}
            onDelete={(id) => {
              haptics.warning();
              Alert.alert('Delete measurement entry?', 'This action cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteMeasurementMutation.mutate(id),
                },
              ]);
            }}
            isLoading={isMeasurementsLoading}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 1. WEIGHT SECTION & SVG CHART
// ==========================================

function WeightSection({
  chronologicalWeights,
  recentWeights,
  currentWeight,
  startWeight,
  targetWeight,
  weightDelta,
  isLogging,
  setIsLogging,
  newWeight,
  setNewWeight,
  weightDate,
  setWeightDate,
  onSave,
  isSaving,
  onDelete,
  isLoading,
}: {
  chronologicalWeights: WeightEntry[];
  recentWeights: WeightEntry[];
  currentWeight: number | null;
  startWeight: number | null;
  targetWeight: number | null;
  weightDelta: number | null;
  isLogging: boolean;
  setIsLogging: (v: boolean) => void;
  newWeight: string;
  setNewWeight: (v: string) => void;
  weightDate: string;
  setWeightDate: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onDelete: (id: string, label: string) => void;
  isLoading: boolean;
}) {
  return (
    <View style={styles.sectionWrap}>
      {/* KPI Cards Row */}
      <Animated.View entering={enter(0)} style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Current</Text>
          <Text style={styles.kpiValue}>
            {currentWeight != null ? `${currentWeight}` : '--'}
            <Text style={styles.kpiUnit}> kg</Text>
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Start</Text>
          <Text style={styles.kpiValue}>
            {startWeight != null ? `${startWeight}` : '--'}
            <Text style={styles.kpiUnit}> kg</Text>
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Net Change</Text>
          <View style={styles.deltaValueRow}>
            {weightDelta != null && weightDelta !== 0 ? (
              weightDelta > 0 ? (
                <TrendingUp size={14} color={colors.amber} />
              ) : (
                <TrendingDown size={14} color={colors.primaryLight} />
              )
            ) : (
              <Minus size={14} color={colors.textMuted} />
            )}
            <Text
              style={[
                styles.kpiValue,
                weightDelta != null && weightDelta < 0 && styles.textSuccess,
                weightDelta != null && weightDelta > 0 && styles.textWarning,
              ]}
            >
              {weightDelta != null
                ? `${weightDelta > 0 ? '+' : ''}${weightDelta}`
                : '--'}
              <Text style={styles.kpiUnit}> kg</Text>
            </Text>
          </View>
        </View>

        {targetWeight != null && (
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Goal Target</Text>
            <Text style={[styles.kpiValue, styles.textTarget]}>
              {targetWeight}
              <Text style={styles.kpiUnit}> kg</Text>
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Trajectory Chart Card */}
      <Animated.View entering={enter(1)}>
        <Card elevated style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Trend Trajectory</Text>
              <Text style={styles.cardTitle}>Weight Over Time</Text>
            </View>
            <Badge
              label={`${chronologicalWeights.length} weigh-in${
                chronologicalWeights.length === 1 ? '' : 's'
              }`}
              tone="cyan"
            />
          </View>

          {chronologicalWeights.length >= 2 ? (
            <WeightSvgChart
              weights={chronologicalWeights}
              targetWeight={targetWeight}
            />
          ) : (
            <View style={styles.emptyChartBox}>
              <Scale size={28} color={colors.textMuted} />
              <Text style={styles.emptyChartText}>
                Log at least 2 weigh-ins to render the interactive trend trajectory.
              </Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Log Form Collapse */}
      {isLogging && (
        <Animated.View entering={enter(1)}>
          <Card elevated highlighted style={styles.logFormCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Record Weigh-in</Text>
              <PressableScale onPress={() => setIsLogging(false)}>
                <X size={18} color={colors.textMuted} />
              </PressableScale>
            </View>

            <View style={styles.formInputsRow}>
              <View style={styles.flex2}>
                <Input
                  label="Weight (kg)"
                  keyboardType="decimal-pad"
                  placeholder="e.g. 74.5"
                  value={newWeight}
                  onChangeText={setNewWeight}
                  autoFocus
                />
              </View>
              <View style={styles.flex3}>
                <Input
                  label="Date (YYYY-MM-DD)"
                  value={weightDate}
                  onChangeText={setWeightDate}
                />
              </View>
            </View>

            <Button
              title="Save Weigh-in"
              size="md"
              loading={isSaving}
              onPress={onSave}
              style={styles.saveBtn}
            />
          </Card>
        </Animated.View>
      )}

      {/* Weigh-in History List */}
      <Animated.View entering={enter(2)} style={styles.historyWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Weigh-in History</Text>
          {!isLogging && (
            <PressableScale
              haptic="selection"
              onPress={() => setIsLogging(true)}
              style={styles.quickAddLink}
            >
              <Plus size={14} color={colors.primaryLight} />
              <Text style={styles.quickAddLinkText}>Log Weight</Text>
            </PressableScale>
          )}
        </View>

        {recentWeights.length === 0 ? (
          <EmptyState
            icon={<Scale size={26} color={colors.primaryLight} />}
            title="No weight entries yet"
            description="Log your morning weight periodically to track your body recomposition journey."
            action={
              <Button
                title="Log First Weigh-in"
                icon={<Plus size={16} color="#FFFFFF" />}
                iconPosition="left"
                onPress={() => setIsLogging(true)}
              />
            }
          />
        ) : (
          <View style={styles.historyList}>
            {recentWeights.map((w, idx) => {
              const prev = recentWeights[idx + 1];
              const diff =
                prev != null ? Math.round((w.weight_kg - prev.weight_kg) * 10) / 10 : null;

              return (
                <View key={w.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyDateBox}>
                      <Calendar size={14} color={colors.primaryLight} />
                      <Text style={styles.historyDate}>{formatDayLabel(w.date)}</Text>
                    </View>
                    <Text style={styles.historyIsoDate}>{w.date}</Text>
                  </View>

                  <View style={styles.historyRight}>
                    <View style={styles.historyWeightCol}>
                      <Text style={styles.historyWeightVal}>
                        {w.weight_kg} <Text style={styles.historyWeightUnit}>kg</Text>
                      </Text>
                      {diff != null && (
                        <Text
                          style={[
                            styles.historyDiff,
                            diff < 0 ? styles.textSuccess : diff > 0 ? styles.textWarning : null,
                          ]}
                        >
                          {diff > 0 ? `+${diff}` : `${diff}`} kg
                        </Text>
                      )}
                    </View>

                    <PressableScale
                      haptic="medium"
                      onPress={() => onDelete(w.id, `${w.weight_kg} kg on ${w.date}`)}
                      style={styles.historyDeleteBtn}
                      accessibilityLabel="Delete entry"
                    >
                      <Trash2 size={16} color={colors.textMuted} />
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// Native SVG Line Chart for Weight
function WeightSvgChart({
  weights,
  targetWeight,
}: {
  weights: WeightEntry[];
  targetWeight: number | null;
}) {
  const [layoutWidth, setLayoutWidth] = useState(320);
  const chartHeight = 180;
  const paddingHoriz = 24;
  const paddingTop = 20;
  const paddingBottom = 30;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50) setLayoutWidth(w);
  };

  const values = weights.map((w) => w.weight_kg);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  if (targetWeight != null) {
    minVal = Math.min(minVal, targetWeight);
    maxVal = Math.max(maxVal, targetWeight);
  }

  // Margin buffer
  const range = Math.max(maxVal - minVal, 1.5);
  const chartMin = minVal - range * 0.15;
  const chartMax = maxVal + range * 0.15;
  const valRange = chartMax - chartMin;

  const innerW = layoutWidth - paddingHoriz * 2;
  const innerH = chartHeight - paddingTop - paddingBottom;

  const points = weights.map((w, idx) => {
    const x =
      paddingHoriz +
      (weights.length === 1 ? innerW / 2 : (idx / (weights.length - 1)) * innerW);
    const y = paddingTop + (1 - (w.weight_kg - chartMin) / valRange) * innerH;
    return { x, y, weight: w.weight_kg, date: w.date };
  });

  // SVG Line path
  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  // Area path
  const areaPath = `${linePath} L ${points[points.length - 1].x},${
    chartHeight - paddingBottom
  } L ${points[0].x},${chartHeight - paddingBottom} Z`;

  // Target Y
  const targetY =
    targetWeight != null
      ? paddingTop + (1 - (targetWeight - chartMin) / valRange) * innerH
      : null;

  return (
    <View onLayout={onLayout} style={styles.chartContainer}>
      <Svg width={layoutWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={colors.primaryLight} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Baseline grid lines */}
        <Line
          x1={paddingHoriz}
          y1={paddingTop}
          x2={layoutWidth - paddingHoriz}
          y2={paddingTop}
          stroke={colors.borderSubtle}
          strokeDasharray="4 4"
        />
        <Line
          x1={paddingHoriz}
          y1={paddingTop + innerH / 2}
          x2={layoutWidth - paddingHoriz}
          y2={paddingTop + innerH / 2}
          stroke={colors.borderSubtle}
          strokeDasharray="4 4"
        />
        <Line
          x1={paddingHoriz}
          y1={chartHeight - paddingBottom}
          x2={layoutWidth - paddingHoriz}
          y2={chartHeight - paddingBottom}
          stroke={colors.borderSubtle}
        />

        {/* Target line */}
        {targetY != null && (
          <Line
            x1={paddingHoriz}
            y1={targetY}
            x2={layoutWidth - paddingHoriz}
            y2={targetY}
            stroke={colors.cyan}
            strokeDasharray="6 3"
            strokeWidth={1.5}
          />
        )}

        {/* Shaded Area */}
        <Path d={areaPath} fill="url(#chartGradient)" />

        {/* Stroke Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={colors.primaryLight}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((pt, i) => (
          <React.Fragment key={`pt-${i}`}>
            <Circle cx={pt.x} cy={pt.y} r={5} fill={colors.surface} stroke={colors.primaryLight} strokeWidth={2.5} />
          </React.Fragment>
        ))}

        {/* Axis Labels */}
        <SvgText
          x={paddingHoriz}
          y={chartHeight - 10}
          fill={colors.textMuted}
          fontSize="10"
          fontWeight="600"
        >
          {weights[0]?.date.slice(5)}
        </SvgText>
        <SvgText
          x={layoutWidth - paddingHoriz}
          y={chartHeight - 10}
          fill={colors.textMuted}
          fontSize="10"
          fontWeight="600"
          textAnchor="end"
        >
          {weights[weights.length - 1]?.date.slice(5)}
        </SvgText>
        <SvgText
          x={layoutWidth - paddingHoriz + 2}
          y={paddingTop + 4}
          fill={colors.textMuted}
          fontSize="9"
          textAnchor="end"
        >
          {Math.round(chartMax)}kg
        </SvgText>
        <SvgText
          x={layoutWidth - paddingHoriz + 2}
          y={chartHeight - paddingBottom - 2}
          fill={colors.textMuted}
          fontSize="9"
          textAnchor="end"
        >
          {Math.round(chartMin)}kg
        </SvgText>
      </Svg>
    </View>
  );
}

// ==========================================
// 2. PR RECORDS SECTION
// ==========================================

function PrsSection({
  prs,
  allPrsCount,
  search,
  setSearch,
  selectedMuscle,
  setSelectedMuscle,
  isLoading,
}: {
  prs: PersonalRecord[];
  allPrsCount: number;
  search: string;
  setSearch: (v: string) => void;
  selectedMuscle: string;
  setSelectedMuscle: (v: string) => void;
  isLoading: boolean;
}) {
  return (
    <View style={styles.sectionWrap}>
      {/* Search and Filters */}
      <Animated.View entering={enter(0)}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search exercises or muscles..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search ? (
            <PressableScale onPress={() => setSearch('')}>
              <X size={16} color={colors.textMuted} />
            </PressableScale>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          {MUSCLE_FILTERS.map((cat) => {
            const active = selectedMuscle === cat;
            return (
              <PressableScale
                key={cat}
                haptic="selection"
                onPress={() => setSelectedMuscle(cat)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {cat}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* PR Cards Grid/List */}
      <Animated.View entering={enter(1)}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Personal Records ({prs.length})
          </Text>
          <Text style={styles.sectionMeta}>
            Auto-recorded from workouts
          </Text>
        </View>

        {prs.length === 0 ? (
          <EmptyState
            icon={<Trophy size={28} color={colors.warning} />}
            title="No records found"
            description={
              allPrsCount === 0
                ? 'Complete workouts with compound or isolation lifts to start recording your personal records!'
                : 'No PR matches your filter query.'
            }
          />
        ) : (
          <View style={styles.prList}>
            {prs.map((pr) => (
              <Card key={pr.id} elevated style={styles.prItemCard}>
                <View style={styles.prHeader}>
                  <View style={styles.prIconBox}>
                    <Trophy size={18} color={colors.warning} />
                  </View>
                  <View style={styles.prHeaderInfo}>
                    <Text style={styles.prExerciseName} numberOfLines={1}>
                      {pr.exercise_name}
                    </Text>
                    <Text style={styles.prMuscle}>{pr.primary_muscle || 'Compound'}</Text>
                  </View>
                  <Badge
                    label={`e1RM ${Math.round(pr.estimated_one_rep_max || pr.max_weight_kg)} kg`}
                    tone="emerald"
                  />
                </View>

                <View style={styles.prStatsRow}>
                  <View style={styles.prStatCol}>
                    <Text style={styles.prStatLabel}>Max Weight</Text>
                    <Text style={styles.prStatVal}>
                      {pr.max_weight_kg} <Text style={styles.prStatUnit}>kg</Text>
                    </Text>
                  </View>

                  <View style={styles.prDivider} />

                  <View style={styles.prStatCol}>
                    <Text style={styles.prStatLabel}>Reps</Text>
                    <Text style={styles.prStatVal}>
                      {pr.reps} <Text style={styles.prStatUnit}>reps</Text>
                    </Text>
                  </View>

                  <View style={styles.prDivider} />

                  <View style={styles.prStatCol}>
                    <Text style={styles.prStatLabel}>Date</Text>
                    <Text style={styles.prStatValDate}>
                      {pr.achieved_at ? pr.achieved_at.slice(0, 10) : '--'}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ==========================================
// 3. BODY MEASUREMENTS SECTION
// ==========================================

function MeasurementsSection({
  measurements,
  isLogging,
  setIsLogging,
  date,
  setDate,
  waist,
  setWaist,
  chest,
  setChest,
  arms,
  setArms,
  hips,
  setHips,
  thighs,
  setThighs,
  notes,
  setNotes,
  onSave,
  isSaving,
  onDelete,
  isLoading,
}: {
  measurements: BodyMeasurement[];
  isLogging: boolean;
  setIsLogging: (v: boolean) => void;
  date: string;
  setDate: (v: string) => void;
  waist: string;
  setWaist: (v: string) => void;
  chest: string;
  setChest: (v: string) => void;
  arms: string;
  setArms: (v: string) => void;
  hips: string;
  setHips: (v: string) => void;
  thighs: string;
  setThighs: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  // Sort oldest to newest for delta calculations
  const chrono = useMemo(() => {
    return [...measurements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [measurements]);

  // Key site delta calculations
  const calculateDelta = (key: keyof BodyMeasurement) => {
    const list = chrono.filter((m) => m[key] != null);
    if (list.length === 0) return null;
    const first = list[0][key] as number;
    const latest = list[list.length - 1][key] as number;
    const delta = Math.round((latest - first) * 10) / 10;
    return { first, latest, delta };
  };

  const waistDelta = calculateDelta('waist_cm');
  const chestDelta = calculateDelta('chest_cm');
  const armsDelta = calculateDelta('arms_cm');
  const hipsDelta = calculateDelta('hips_cm');
  const thighsDelta = calculateDelta('thighs_cm');

  return (
    <View style={styles.sectionWrap}>
      {/* Deltas Grid */}
      <Animated.View entering={enter(0)}>
        <Text style={styles.sectionTitle}>Symmetry &amp; Circumferences</Text>
        <View style={styles.metricsGrid}>
          <MeasurementSummaryCard label="Waist" delta={waistDelta} />
          <MeasurementSummaryCard label="Chest" delta={chestDelta} />
          <MeasurementSummaryCard label="Arms" delta={armsDelta} />
          <MeasurementSummaryCard label="Thighs" delta={thighsDelta} />
          <MeasurementSummaryCard label="Hips" delta={hipsDelta} />
        </View>
      </Animated.View>

      {/* Collapsible Measurement Logger */}
      {isLogging && (
        <Animated.View entering={enter(1)}>
          <Card elevated highlighted style={styles.logFormCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Record Circumferences (cm)</Text>
              <PressableScale onPress={() => setIsLogging(false)}>
                <X size={18} color={colors.textMuted} />
              </PressableScale>
            </View>

            <Input
              label="Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              containerStyle={styles.formInputSpacing}
            />

            <View style={styles.formRow}>
              <Input
                label="Waist (cm)"
                keyboardType="decimal-pad"
                value={waist}
                onChangeText={setWaist}
                containerStyle={styles.half}
              />
              <Input
                label="Chest (cm)"
                keyboardType="decimal-pad"
                value={chest}
                onChangeText={setChest}
                containerStyle={styles.half}
              />
            </View>

            <View style={styles.formRow}>
              <Input
                label="Arms (cm)"
                keyboardType="decimal-pad"
                value={arms}
                onChangeText={setArms}
                containerStyle={styles.half}
              />
              <Input
                label="Hips (cm)"
                keyboardType="decimal-pad"
                value={hips}
                onChangeText={setHips}
                containerStyle={styles.half}
              />
            </View>

            <View style={styles.formRow}>
              <Input
                label="Thighs (cm)"
                keyboardType="decimal-pad"
                value={thighs}
                onChangeText={setThighs}
                containerStyle={styles.half}
              />
              <Input
                label="Notes"
                placeholder="Optional notes"
                value={notes}
                onChangeText={setNotes}
                containerStyle={styles.half}
              />
            </View>

            <Button
              title="Save Measurements"
              size="md"
              loading={isSaving}
              onPress={onSave}
              style={styles.saveBtn}
            />
          </Card>
        </Animated.View>
      )}

      {/* Measurement Logs List */}
      <Animated.View entering={enter(2)} style={styles.historyWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Measurement Logbook</Text>
          {!isLogging && (
            <PressableScale
              haptic="selection"
              onPress={() => setIsLogging(true)}
              style={styles.quickAddLink}
            >
              <Plus size={14} color={colors.primaryLight} />
              <Text style={styles.quickAddLinkText}>Add Measures</Text>
            </PressableScale>
          )}
        </View>

        {measurements.length === 0 ? (
          <EmptyState
            icon={<Ruler size={28} color={colors.cyan} />}
            title="No tape measurements yet"
            description="Log tape circumferences (waist, arms, chest) every 2–4 weeks to monitor muscular hypertrophy and fat loss."
            action={
              <Button
                title="Log First Measurements"
                icon={<Plus size={16} color="#FFFFFF" />}
                iconPosition="left"
                onPress={() => setIsLogging(true)}
              />
            }
          />
        ) : (
          <View style={styles.mLogList}>
            {measurements.map((entry) => (
              <Card key={entry.id} elevated style={styles.mLogCard}>
                <View style={styles.mLogHeader}>
                  <View style={styles.historyDateBox}>
                    <Calendar size={14} color={colors.cyan} />
                    <Text style={styles.historyDate}>{formatDayLabel(entry.date)}</Text>
                  </View>
                  <PressableScale
                    haptic="medium"
                    onPress={() => onDelete(entry.id)}
                    style={styles.historyDeleteBtn}
                  >
                    <Trash2 size={16} color={colors.textMuted} />
                  </PressableScale>
                </View>

                <View style={styles.mPillGrid}>
                  {entry.waist_cm != null && (
                    <View style={styles.mPill}>
                      <Text style={styles.mPillLabel}>Waist</Text>
                      <Text style={styles.mPillVal}>{entry.waist_cm} cm</Text>
                    </View>
                  )}
                  {entry.chest_cm != null && (
                    <View style={styles.mPill}>
                      <Text style={styles.mPillLabel}>Chest</Text>
                      <Text style={styles.mPillVal}>{entry.chest_cm} cm</Text>
                    </View>
                  )}
                  {entry.arms_cm != null && (
                    <View style={styles.mPill}>
                      <Text style={styles.mPillLabel}>Arms</Text>
                      <Text style={styles.mPillVal}>{entry.arms_cm} cm</Text>
                    </View>
                  )}
                  {entry.thighs_cm != null && (
                    <View style={styles.mPill}>
                      <Text style={styles.mPillLabel}>Thighs</Text>
                      <Text style={styles.mPillVal}>{entry.thighs_cm} cm</Text>
                    </View>
                  )}
                  {entry.hips_cm != null && (
                    <View style={styles.mPill}>
                      <Text style={styles.mPillLabel}>Hips</Text>
                      <Text style={styles.mPillVal}>{entry.hips_cm} cm</Text>
                    </View>
                  )}
                </View>

                {entry.notes ? (
                  <Text style={styles.mNotesText}>“{entry.notes}”</Text>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function MeasurementSummaryCard({
  label,
  delta,
}: {
  label: string;
  delta: { first: number; latest: number; delta: number } | null;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricCardLabel}>{label}</Text>
      <Text style={styles.metricCardValue}>
        {delta != null ? `${delta.latest}` : '--'}
        <Text style={styles.metricCardUnit}> cm</Text>
      </Text>
      <View style={styles.metricCardDeltaRow}>
        {delta != null ? (
          <Text
            style={[
              styles.metricCardDeltaText,
              delta.delta > 0 && styles.textSuccess,
              delta.delta < 0 && styles.textWarning,
            ]}
          >
            {delta.delta > 0 ? `+${delta.delta}` : `${delta.delta}`} cm from start
          </Text>
        ) : (
          <Text style={styles.metricCardSub}>No data</Text>
        )}
      </View>
    </View>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderGlow,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  sectionWrap: {
    gap: spacing.lg,
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
  deltaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  textSuccess: {
    color: colors.primaryLight,
  },
  textWarning: {
    color: colors.amber,
  },
  textTarget: {
    color: colors.cyan,
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
  logFormCard: {
    padding: spacing.md,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  formInputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formInputSpacing: {
    marginBottom: spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex2: {
    flex: 2,
  },
  flex3: {
    flex: 3,
  },
  half: {
    flex: 1,
  },
  saveBtn: {
    marginTop: spacing.md,
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
  sectionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  quickAddLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickAddLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  filterChipRow: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  prList: {
    gap: spacing.sm,
  },
  prItemCard: {
    padding: spacing.md,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  prIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.amberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prHeaderInfo: {
    flex: 1,
  },
  prExerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  prMuscle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  prStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  prStatCol: {
    alignItems: 'center',
  },
  prStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  prStatVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  prStatValDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  prStatUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  prDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  metricCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metricCardValue: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  metricCardUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  metricCardDeltaRow: {
    marginTop: 6,
  },
  metricCardDeltaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricCardSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  mLogList: {
    gap: spacing.sm,
  },
  mLogCard: {
    padding: spacing.md,
  },
  mLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  mPill: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  mPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  mPillVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  mNotesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
