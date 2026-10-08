import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
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
  ChevronDown,
  ChevronUp,
  Utensils,
  Camera,
  Sparkles,
  Flame,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api, extractErrorMessage } from '../../src/api/client';
import { NutritionProgressSection } from '../../src/components/progress/NutritionProgressSection';
import { CalorieBurnSection } from '../../src/components/progress/CalorieBurnSection';
import { ProgressPhotoGallery } from '../../src/components/progress/ProgressPhotoGallery';
import {
  PrCelebrationModal,
  type PrCelebrationData,
} from '../../src/components/progress/PrCelebrationModal';
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
import { radius, spacing, useTheme } from '../../src/theme';
import { useStyles } from '../../src/components/progress/progress.styles';
import { formatDayLabel, parseNumberInput, toDateKey } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useAuth } from '../../src/providers/auth';
import type { BodyMeasurement, PersonalRecord, WeightEntry } from '../../src/types';

type TabKey = 'WEIGHT' | 'PHOTOS' | 'NUTRITION' | 'BURN' | 'MEASUREMENTS' | 'PRS';

const TABS: { key: TabKey; label: string; icon: typeof Scale }[] = [
  { key: 'WEIGHT', label: 'Weight', icon: Scale },
  { key: 'PHOTOS', label: 'Photos', icon: Camera },
  { key: 'NUTRITION', label: 'Nutrition', icon: Utensils },
  { key: 'BURN', label: 'Activity', icon: Flame },
  { key: 'MEASUREMENTS', label: 'Measurements', icon: Ruler },
  { key: 'PRS', label: 'Records', icon: Trophy },
];

const MUSCLE_FILTERS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];

const enter = (i: number) => FadeInDown.delay(50 + i * 50).duration(400);
const HISTORY_PAGE_SIZE = 5;

type WeightTrendPoint = {
  date: string;
  rawWeight: number;
  trendWeight: number;
  variance: number;
};

// Single source of truth for "trend weight": a 7-day exponential moving average
// that smooths day-to-day noise (hydration, food, bowel movements) out of raw
// scale readings so the underlying trajectory is visible. alpha = 2/(7+1); the
// gap between log dates scales the per-step alpha (capped at 14 days) so an
// irregular logging cadence doesn't under- or over-weight a reading.
// Used identically by the KPI card and the trend chart so they never disagree.
function computeWeightTrend(chronological: WeightEntry[]): WeightTrendPoint[] {
  if (chronological.length === 0) return [];
  const emaAlpha = 2 / (7 + 1);
  let prevEma = chronological[0].weight_kg;
  let prevDate = new Date(chronological[0].date).getTime();

  return chronological.map((w, idx) => {
    const currDate = new Date(w.date).getTime();
    const dayDiff = Math.max(1, Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24)));
    const alpha = idx === 0 ? 1 : 1 - Math.pow(1 - emaAlpha, Math.min(dayDiff, 14));
    const trend =
      idx === 0 ? w.weight_kg : Math.round((alpha * w.weight_kg + (1 - alpha) * prevEma) * 100) / 100;
    prevEma = trend;
    prevDate = currDate;
    const variance = Math.round((w.weight_kg - trend) * 10) / 10;
    return { date: w.date, rawWeight: w.weight_kg, trendWeight: trend, variance };
  });
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const bottomClearance = useTabBarClearance();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('WEIGHT');

  // Queries
  const {
    data: weights = [],
    isLoading: isWeightsLoading,
    isRefetching: isWeightsRefetching,
    isError: isWeightsError,
    refetch: refetchWeights,
  } = useQuery({
    queryKey: ['weights'],
    queryFn: () => api.getWeights(),
  });

  const {
    data: nutritionHistory,
    isLoading: isNutritionLoading,
    isRefetching: isNutritionRefetching,
    refetch: refetchNutrition,
  } = useQuery({
    queryKey: ['nutritionHistory', 365],
    queryFn: () => api.getNutritionHistory(365),
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

  const {
    data: photoGroups = [],
    isLoading: isPhotosLoading,
    isRefetching: isPhotosRefetching,
    refetch: refetchPhotos,
  } = useQuery({
    queryKey: ['progressPhotosByDate'],
    queryFn: () => api.getProgressPhotosByDate(),
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
  });

  const {
    data: calorieBurnHistory,
    isLoading: isCalorieBurnLoading,
    isRefetching: isCalorieBurnRefetching,
    refetch: refetchCalorieBurn,
  } = useQuery({
    queryKey: ['calorieBurnHistory', 180],
    queryFn: () => api.getCalorieBurnHistory(180),
    enabled: activeTab === 'BURN',
  });

  const isRefreshing =
    isWeightsRefetching ||
    isPhotosRefetching ||
    isNutritionRefetching ||
    isPrsRefetching ||
    isMeasurementsRefetching ||
    isCalorieBurnRefetching;
  const onRefresh = async () => {
    haptics.light();
    await Promise.all([
      refetchWeights(),
      refetchPhotos(),
      refetchNutrition(),
      refetchPrs(),
      refetchMeasurements(),
      ...(activeTab === 'BURN' ? [refetchCalorieBurn()] : []),
    ]);
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

  // PR Filters & Celebration State
  const [prSearch, setPrSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [celebratingPr, setCelebratingPr] = useState<PrCelebrationData | null>(null);
  const [isLoggingPr, setIsLoggingPr] = useState(false);
  const [prExerciseQuery, setPrExerciseQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string } | null>(null);
  const [prWeight, setPrWeight] = useState('');
  const [prReps, setPrReps] = useState('1');
  const [prDate, setPrDate] = useState(() => toDateKey(new Date()));

  const { data: searchedExercises = [] } = useQuery({
    queryKey: ['exercisesPrSearch', prExerciseQuery],
    queryFn: () => api.searchExercises(prExerciseQuery),
    enabled: isLoggingPr,
  });

  const logPrMutation = useMutation({
    mutationFn: async () => {
      const w = parseNumberInput(prWeight);
      const r = parseInt(prReps, 10) || 1;
      if (!selectedExercise?.id) {
        throw new Error('Please select an exercise from the list.');
      }
      if (!w || w <= 0 || w > 700) {
        throw new Error('Please enter a valid weight.');
      }
      return api.logPersonalRecord({
        exercise: selectedExercise.id,
        max_weight_kg: w,
        reps: r,
        achieved_at: prDate,
      });
    },
    onSuccess: (savedRecord) => {
      haptics.success();
      setIsLoggingPr(false);
      setPrWeight('');
      setPrReps('1');
      setPrExerciseQuery('');
      const exName = selectedExercise?.name || savedRecord.exercise_name || 'Exercise';
      setSelectedExercise(null);
      queryClient.invalidateQueries({ queryKey: ['personalRecords'] });
      setCelebratingPr({
        exercise_name: exName,
        max_weight_kg: savedRecord.max_weight_kg,
        reps: savedRecord.reps,
        estimated_one_rep_max: savedRecord.estimated_one_rep_max,
        achieved_at: savedRecord.achieved_at,
      });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't save PR", extractErrorMessage(err));
    },
  });

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

  const weightDelta = useMemo(() => {
    if (currentWeight == null || startWeight == null || chronologicalWeights.length <= 1) {
      return null;
    }
    const diff = currentWeight - startWeight;
    return Number(diff.toFixed(2));
  }, [currentWeight, startWeight, chronologicalWeights.length]);

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
                  if (activeTab === 'NUTRITION') {
                    router.push('/meal/add');
                  } else if (activeTab === 'MEASUREMENTS') {
                    setIsLoggingMeasurement((v) => !v);
                  } else if (activeTab === 'PRS') {
                    setIsLoggingPr((v) => !v);
                  } else if (activeTab === 'BURN') {
                    router.push('/workout/log');
                  } else {
                    setIsLoggingWeight((v) => !v);
                  }
                }}
                style={styles.headerAddBtn}
                accessibilityLabel={
                  activeTab === 'NUTRITION'
                    ? 'Log food'
                    : activeTab === 'MEASUREMENTS'
                    ? 'Log measurement'
                    : activeTab === 'PRS'
                    ? 'Log personal record'
                    : activeTab === 'BURN'
                    ? 'Log workout'
                    : 'Log weight'
                }
              >
                <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
              </PressableScale>
          }
        />

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={styles.tabsScroller}
        >
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
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${tab.label} tab`}
              >
                <Icon
                  size={15}
                  color={active ? colors.primaryLight : colors.textMuted}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

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
            isError={isWeightsError}
            onRetry={refetchWeights}
          />
        )}

        {activeTab === 'PHOTOS' && (
          <ProgressPhotoGallery
            groups={photoGroups}
            isLoading={isPhotosLoading}
            onRefresh={refetchPhotos}
            currentWeight={currentWeight}
          />
        )}

        {activeTab === 'NUTRITION' && (
          <NutritionProgressSection
            nutritionHistory={nutritionHistory}
            weights={chronologicalWeights}
            isLoading={isNutritionLoading}
            onNavigateToNutrition={() => router.push('/(tabs)/nutrition')}
          />
        )}

        {activeTab === 'BURN' && (
          <CalorieBurnSection
            dashboardStats={dashboardStats}
            history={calorieBurnHistory?.history}
            isLoading={isCalorieBurnLoading && !calorieBurnHistory}
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
            onCelebratePr={(prData) => setCelebratingPr(prData)}
            isLogging={isLoggingPr}
            setIsLogging={setIsLoggingPr}
            exerciseQuery={prExerciseQuery}
            setExerciseQuery={setPrExerciseQuery}
            searchedExercises={searchedExercises}
            selectedExercise={selectedExercise}
            setSelectedExercise={setSelectedExercise}
            prWeight={prWeight}
            setPrWeight={setPrWeight}
            prReps={prReps}
            setPrReps={setPrReps}
            prDate={prDate}
            setPrDate={setPrDate}
            onSavePr={() => logPrMutation.mutate()}
            isSavingPr={logPrMutation.isPending}
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

      {/* PR Celebration Moment Modal */}
      <PrCelebrationModal
        visible={!!celebratingPr}
        pr={celebratingPr}
        onClose={() => setCelebratingPr(null)}
      />
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
  isError,
  onRetry,
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
  isError: boolean;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const visibleWeights = showAllHistory
    ? recentWeights
    : recentWeights.slice(0, HISTORY_PAGE_SIZE);

  const latestTrendWeight = useMemo(() => {
    const trend = computeWeightTrend(chronologicalWeights);
    if (trend.length === 0) return null;
    return Math.round(trend[trend.length - 1].trendWeight * 10) / 10;
  }, [chronologicalWeights]);

  if (isError) {
    return (
      <View style={styles.sectionWrap}>
        <EmptyState
          icon={<Scale size={26} color={colors.amber} />}
          title="Couldn't load weight data"
          description="Check your connection and try again."
          action={<Button title="Retry" onPress={onRetry} />}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.sectionWrap}>
        <View style={styles.heroStatCard}>
          <View style={styles.skeletonLineSm} />
          <View style={styles.skeletonLineLg} />
        </View>
        <View style={[styles.chartCard, styles.skeletonChart]} />
      </View>
    );
  }

  return (
    <View style={styles.sectionWrap}>
      {/* Current weight gets the strongest visual emphasis; everything else is secondary */}
      <Animated.View entering={enter(0)} style={styles.heroStatCard}>
        <View style={styles.heroStatHeader}>
          <Text style={styles.heroStatLabel}>Current Weight</Text>
          {recentWeights[0]?.date && (
            <Text style={styles.heroStatCaption} numberOfLines={1}>
              as of {formatDayLabel(recentWeights[0].date)}
            </Text>
          )}
        </View>
        <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {currentWeight != null ? currentWeight : '--'}
          <Text style={styles.heroStatUnit}> kg</Text>
        </Text>
      </Animated.View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            7d Trend
          </Text>
          <Text
            style={[styles.kpiValue, { color: colors.primaryLight }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {latestTrendWeight != null ? `${latestTrendWeight}` : '--'}
            <Text style={styles.kpiUnit}> kg</Text>
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Starting
          </Text>
          <Text
            style={styles.kpiValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {startWeight != null ? `${startWeight}` : '--'}
            <Text style={styles.kpiUnit}> kg</Text>
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Net Change
          </Text>
          <Text style={styles.kpiCaption} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            since start
          </Text>
          <View style={styles.deltaValueRow}>
            {weightDelta != null && weightDelta !== 0 ? (
              weightDelta > 0 ? (
                <TrendingUp size={12} color={colors.amber} strokeWidth={2.4} />
              ) : (
                <TrendingDown size={12} color={colors.primaryLight} strokeWidth={2.4} />
              )
            ) : (
              <Minus size={12} color={colors.textMuted} strokeWidth={2.4} />
            )}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[
                styles.kpiValue,
                styles.deltaText,
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

        {targetWeight != null ? (
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Target
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.kpiValue, styles.textTarget]}
            >
              {targetWeight}
              <Text style={styles.kpiUnit}> kg</Text>
            </Text>
          </View>
        ) : (
          <PressableScale
            haptic="selection"
            onPress={() => router.push('/profile-edit')}
            style={[styles.kpiCard, styles.kpiCardMuted]}
            accessibilityLabel="Set a target weight"
          >
            <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Target
            </Text>
            <Text style={styles.kpiSetLink} numberOfLines={1}>
              Set target
            </Text>
          </PressableScale>
        )}
      </View>

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

          <WeightSvgChart
            weights={chronologicalWeights}
            targetWeight={targetWeight}
          />
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
            {visibleWeights.map((w) => {
              const idx = recentWeights.indexOf(w);
              const prev = recentWeights[idx + 1];
              const diff =
                prev != null ? Number((w.weight_kg - prev.weight_kg).toFixed(2)) : null;

              return (
                <ReanimatedSwipeable
                  key={w.id}
                  friction={2}
                  rightThreshold={48}
                  overshootRight={false}
                  onSwipeableOpen={(direction) => {
                    if (direction === 'left') {
                      haptics.medium();
                      onDelete(w.id, `${w.weight_kg} kg on ${w.date}`);
                    }
                  }}
                  renderRightActions={() => (
                    <View style={styles.swipeDelete}>
                      <Trash2 size={18} color="#FFFFFF" />
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </View>
                  )}
                >
                  <View style={styles.historyItem}>
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
                </ReanimatedSwipeable>
              );
            })}
          </View>
        )}

        {recentWeights.length > HISTORY_PAGE_SIZE && (
          <PressableScale
            haptic="selection"
            onPress={() => setShowAllHistory((v) => !v)}
            style={styles.showMoreBtn}
            accessibilityLabel={showAllHistory ? 'Show fewer weigh-ins' : 'Show all weigh-ins'}
          >
            <Text style={styles.showMoreText}>
              {showAllHistory ? 'Show less' : `Show all ${recentWeights.length} weigh-ins`}
            </Text>
            {showAllHistory ? (
              <ChevronUp size={16} color={colors.primaryLight} />
            ) : (
              <ChevronDown size={16} color={colors.primaryLight} />
            )}
          </PressableScale>
        )}
      </Animated.View>
    </View>
  );
}

type TimeframeScope = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
const TIMEFRAME_SCOPES: TimeframeScope[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

// Native SVG Line Chart for Weight with Timeframe Scopes, 7-Day EMA Smoothed Trend,
// Touch Scrubbing with Vertical Cursor Line, and Precise Tooltip Popups
function WeightSvgChart({
  weights,
  targetWeight,
}: {
  weights: WeightEntry[];
  targetWeight: number | null;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [layoutWidth, setLayoutWidth] = useState(320);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<'both' | 'trend' | 'raw'>('both');
  const [timeframe, setTimeframe] = useState<TimeframeScope>('ALL');
  const chartHeight = 195;
  // Asymmetric padding: the plot only needs a couple of px on the left, while the
  // right side reserves just enough room for the kg axis labels — this lets the
  // actual line/points use nearly the full card width instead of large dead margins.
  const paddingLeft = 6;
  const paddingRight = 34;
  const paddingTop = 26;
  const paddingBottom = 32;

  // Filter weights according to selected timeframe scope
  const scopedWeights = useMemo(() => {
    if (weights.length === 0) return [];
    if (timeframe === 'ALL' || weights.length <= 1) return weights;
    const now = new Date();
    const daysMap: Record<TimeframeScope, number> = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      'ALL': 99999,
    };
    const cutoffTime = now.getTime() - daysMap[timeframe] * 24 * 60 * 60 * 1000;
    const filtered = weights.filter((w) => new Date(w.date).getTime() >= cutoffTime);
    return filtered.length > 0 ? filtered : weights;
  }, [weights, timeframe]);

  useEffect(() => {
    if (scrubIndex == null) return;
    const timer = setTimeout(() => {
      setScrubIndex(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [scrubIndex]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50) setLayoutWidth(w);
  };

  // Trend series shares computeWeightTrend() with the KPI card above so the
  // "7d Trend" figure never disagrees between the stat row and the chart.
  const trendPoints = useMemo(() => computeWeightTrend(scopedWeights), [scopedWeights]);

  const weeklyRate = useMemo(() => {
    if (trendPoints.length < 2) return null;
    const first = trendPoints[0];
    const latest = trendPoints[trendPoints.length - 1];
    const dStart = new Date(first.date).getTime();
    const dEnd = new Date(latest.date).getTime();
    const days = Math.max(1, (dEnd - dStart) / (1000 * 60 * 60 * 24));
    const rate = ((latest.trendWeight - first.trendWeight) / days) * 7;
    return Math.round(rate * 100) / 100;
  }, [trendPoints]);

  const allValues = useMemo(() => {
    const vals: number[] = [];
    scopedWeights.forEach((w) => vals.push(w.weight_kg));
    trendPoints.forEach((p) => vals.push(p.trendWeight));
    if (targetWeight != null) vals.push(targetWeight);
    return vals;
  }, [scopedWeights, trendPoints, targetWeight]);

  const hasValues = allValues.length > 0;
  const minVal = hasValues ? Math.min(...allValues) : 70;
  const maxVal = hasValues ? Math.max(...allValues) : 70;
  const rawSpread = maxVal - minVal;
  // If only 1 distinct value (or 0 data), provide a ±2.5 kg buffer so the point is centered vertically
  const paddingMargin = rawSpread < 0.5 ? 2.5 : Math.max(rawSpread * 0.15, 1.5);
  const chartMin = minVal - paddingMargin;
  const chartMax = maxVal + paddingMargin;
  const valRange = Math.max(chartMax - chartMin, 1);

  const innerW = layoutWidth - paddingLeft - paddingRight;
  const innerH = chartHeight - paddingTop - paddingBottom;

  const points = useMemo(() => {
    return trendPoints.map((tp, idx) => {
      const x =
        paddingLeft +
        (trendPoints.length === 1 ? innerW / 2 : (idx / (trendPoints.length - 1)) * innerW);
      const rawY = paddingTop + (1 - (tp.rawWeight - chartMin) / valRange) * innerH;
      const trendY = paddingTop + (1 - (tp.trendWeight - chartMin) / valRange) * innerH;
      return {
        x,
        rawY,
        trendY,
        weight: tp.rawWeight,
        trend: tp.trendWeight,
        variance: tp.variance,
        date: tp.date,
      };
    });
  }, [trendPoints, innerW, innerH, chartMin, valRange]);

  // Trend line path
  const trendLinePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x},${pt.trendY}` : `${acc} L ${pt.x},${pt.trendY}`;
    }, '');
  }, [points]);

  // Raw line path
  const rawLinePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x},${pt.rawY}` : `${acc} L ${pt.x},${pt.rawY}`;
    }, '');
  }, [points]);

  // Shaded area under trend line
  const trendAreaPath = useMemo(() => {
    if (points.length < 2) return '';
    return `${trendLinePath} L ${points[points.length - 1].x},${
      chartHeight - paddingBottom
    } L ${points[0].x},${chartHeight - paddingBottom} Z`;
  }, [trendLinePath, points]);

  // Target line Y
  const targetY =
    targetWeight != null
      ? paddingTop + (1 - (targetWeight - chartMin) / valRange) * innerH
      : null;

  const onScrub = useCallback((touchX: number) => {
    if (points.length === 0) return;
    let closestIdx = 0;
    let closestDist = Math.abs(points[0].x - touchX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - touchX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setScrubIndex((prev) => {
      if (prev !== closestIdx) {
        haptics.selection();
      }
      return closestIdx;
    });
  }, [points]);

  const composedGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .onBegin((e) => {
        'worklet';
        runOnJS(onScrub)(e.x);
      })
      .onUpdate((e) => {
        'worklet';
        runOnJS(onScrub)(e.x);
      });

    const tapGesture = Gesture.Tap()
      .onEnd((e) => {
        'worklet';
        runOnJS(onScrub)(e.x);
      });

    return Gesture.Race(panGesture, tapGesture);
  }, [onScrub]);

  const activePoint = scrubIndex != null ? points[scrubIndex] : null;

  const baselineWeight = points[0]?.weight ?? null;
  const activeDeltaBaseline =
    activePoint && baselineWeight != null
      ? Number((activePoint.weight - baselineWeight).toFixed(1))
      : null;

  const activeDeltaTarget =
    activePoint && targetWeight != null
      ? Number((activePoint.weight - targetWeight).toFixed(1))
      : null;

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      onLayout={onLayout}
      style={styles.chartContainer}
    >
      {/* Timeframe Scope Selector */}
      <View style={styles.timeframeRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.timeframeScroller}
        >
          <View style={styles.timeframePills}>
            {TIMEFRAME_SCOPES.map((scope) => {
              const active = timeframe === scope;
              return (
                <PressableScale
                  key={scope}
                  haptic="selection"
                  onPress={() => {
                    setTimeframe(scope);
                    setScrubIndex(null);
                  }}
                  style={[styles.timeframePill, active && styles.timeframePillActive]}
                  accessibilityLabel={`Set timeframe to ${scope}`}
                >
                  <Text
                    style={[
                      styles.timeframePillText,
                      active && styles.timeframePillTextActive,
                    ]}
                  >
                    {scope}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </ScrollView>

        {/* View Mode Switcher (Both, Trend, Raw) */}
        <View style={styles.chartModeSwitcher}>
          <PressableScale
            haptic="selection"
            onPress={() => setDisplayMode('both')}
            style={[styles.chartModeBtn, displayMode === 'both' && styles.chartModeBtnActive]}
            accessibilityLabel="Show trend and raw weigh-ins"
          >
            <Text style={[styles.chartModeBtnText, displayMode === 'both' && styles.chartModeBtnTextActive]}>Both</Text>
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={() => setDisplayMode('trend')}
            style={[styles.chartModeBtn, displayMode === 'trend' && styles.chartModeBtnActive]}
            accessibilityLabel="Show smoothed trendline only"
          >
            <Text style={[styles.chartModeBtnText, displayMode === 'trend' && styles.chartModeBtnTextActive]}>Trend</Text>
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={() => setDisplayMode('raw')}
            style={[styles.chartModeBtn, displayMode === 'raw' && styles.chartModeBtnActive]}
            accessibilityLabel="Show raw weigh-ins only"
          >
            <Text style={[styles.chartModeBtnText, displayMode === 'raw' && styles.chartModeBtnTextActive]}>Raw</Text>
          </PressableScale>
        </View>
      </View>

      {/* Metrics Bar */}
      <View style={styles.chartControlBar}>
        <View style={styles.chartMetricRow}>
          {trendPoints.length > 0 && (
            <View style={styles.chartTrendPill}>
              <Text style={styles.chartTrendPillLabel}>
                {trendPoints.length === 1 ? 'Current' : '7d Trend'}
              </Text>
              <Text style={styles.chartTrendPillValue}>
                {(Math.round(trendPoints[trendPoints.length - 1].trendWeight * 10) / 10)} kg
              </Text>
            </View>
          )}
          {weeklyRate != null ? (
            <View
              style={[
                styles.chartRatePill,
                weeklyRate < 0
                  ? styles.pillSuccess
                  : weeklyRate > 0
                    ? styles.pillWarning
                    : styles.pillNeutral,
              ]}
            >
              {weeklyRate < 0 ? (
                <TrendingDown size={11} color={colors.primaryLight} strokeWidth={2.5} />
              ) : weeklyRate > 0 ? (
                <TrendingUp size={11} color={colors.amber} strokeWidth={2.5} />
              ) : (
                <Minus size={11} color={colors.textMuted} strokeWidth={2.5} />
              )}
              <Text
                style={[
                  styles.chartRatePillText,
                  weeklyRate < 0
                    ? styles.textSuccess
                    : weeklyRate > 0
                      ? styles.textWarning
                      : { color: colors.textMuted },
                ]}
              >
                {weeklyRate > 0 ? `+${weeklyRate}` : `${weeklyRate}`} kg/wk
              </Text>
            </View>
          ) : trendPoints.length === 1 ? (
            <View style={[styles.chartRatePill, styles.pillNeutral]}>
              <Text style={[styles.chartRatePillText, { color: colors.textMuted }]}>
                Baseline
              </Text>
            </View>
          ) : null}
        </View>

        {points.length > 0 && (
          <Text style={styles.scrubHintText} numberOfLines={1}>
            {points.length === 1 ? 'Tap the point to inspect details' : 'Tap & drag to inspect a point'}
          </Text>
        )}

        {points.length > 0 && (
          <View style={styles.chartLegendRow}>
            {(displayMode === 'raw' || displayMode === 'both') && (
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendDot, { backgroundColor: colors.primaryLight }]} />
                <Text style={styles.chartLegendText}>Weigh-in</Text>
              </View>
            )}
            {(displayMode === 'trend' || displayMode === 'both') && (
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendSwatch, { backgroundColor: colors.primaryLight }]} />
                <Text style={styles.chartLegendText}>7d trend</Text>
              </View>
            )}
            {targetWeight != null && (
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendSwatch, styles.chartLegendDashed, { borderColor: colors.cyan }]} />
                <Text style={styles.chartLegendText}>Target</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <GestureDetector gesture={composedGesture}>
        <View style={{ width: layoutWidth, height: chartHeight }}>
          <Svg width={layoutWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity="0.38" />
                <Stop offset="100%" stopColor={colors.primaryLight} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Baseline grid lines */}
            <Line
              x1={paddingLeft}
              y1={paddingTop}
              x2={layoutWidth - paddingRight}
              y2={paddingTop}
              stroke={colors.borderSubtle}
              strokeDasharray="4 4"
            />
            <Line
              x1={paddingLeft}
              y1={paddingTop + innerH / 2}
              x2={layoutWidth - paddingRight}
              y2={paddingTop + innerH / 2}
              stroke={colors.borderSubtle}
              strokeDasharray="4 4"
            />
            <Line
              x1={paddingLeft}
              y1={chartHeight - paddingBottom}
              x2={layoutWidth - paddingRight}
              y2={chartHeight - paddingBottom}
              stroke={colors.borderSubtle}
            />

            {/* Target line, always labeled with its value so it reads correctly without scrubbing */}
            {targetY != null && (
              <>
                <Line
                  x1={paddingLeft}
                  y1={targetY}
                  x2={layoutWidth - paddingRight}
                  y2={targetY}
                  stroke={colors.cyan}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
                <SvgText
                  x={paddingLeft + 2}
                  y={targetY - 5}
                  fill={colors.cyan}
                  fontSize="9"
                  fontWeight="700"
                >
                  {`Target ${targetWeight}kg`}
                </SvgText>
              </>
            )}

            {/* Single point horizontal reference line */}
            {points.length === 1 && (
              <Line
                x1={paddingLeft}
                y1={points[0].rawY}
                x2={layoutWidth - paddingRight}
                y2={points[0].rawY}
                stroke={colors.primaryLight}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                opacity={0.35}
              />
            )}

            {/* Shaded Area under Trendline */}
            {trendAreaPath !== '' && (displayMode === 'trend' || displayMode === 'both') && (
              <Path d={trendAreaPath} fill="url(#chartGradient)" />
            )}

            {/* Raw Weigh-in Line */}
            {rawLinePath !== '' && (displayMode === 'raw' || displayMode === 'both') && (
              <Path
                d={rawLinePath}
                fill="none"
                stroke={displayMode === 'both' ? colors.borderGlow : colors.primaryLight}
                strokeWidth={displayMode === 'both' ? 1.5 : 2.5}
                strokeDasharray={displayMode === 'both' ? '4 3' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={displayMode === 'both' ? 0.6 : 1}
              />
            )}

            {/* Smoothed Trend Line */}
            {trendLinePath !== '' && (displayMode === 'trend' || displayMode === 'both') && (
              <Path
                d={trendLinePath}
                fill="none"
                stroke={colors.primaryLight}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Single Point Presentation */}
            {points.length === 1 && (
              <>
                <Circle
                  cx={points[0].x}
                  cy={points[0].rawY}
                  r={12}
                  fill={colors.primaryLight}
                  fillOpacity={0.2}
                />
                <Circle
                  cx={points[0].x}
                  cy={points[0].rawY}
                  r={scrubIndex === 0 ? 6.5 : 5}
                  fill={scrubIndex === 0 ? colors.amber : colors.primaryLight}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <SvgText
                  x={points[0].x}
                  y={points[0].rawY - 14}
                  textAnchor="middle"
                  fill={colors.primaryLight}
                  fontSize="12"
                  fontWeight="800"
                >
                  {points[0].weight} kg
                </SvgText>
              </>
            )}

            {/* Raw Weigh-in Data Points (when multiple points) */}
            {points.length > 1 && (displayMode === 'raw' || displayMode === 'both') &&
              points.map((pt, i) => (
                <Circle
                  key={`raw-pt-${i}`}
                  cx={pt.x}
                  cy={pt.rawY}
                  r={scrubIndex === i ? 5.5 : 3.5}
                  fill={scrubIndex === i ? colors.amber : colors.surface}
                  stroke={scrubIndex === i ? '#FFFFFF' : displayMode === 'both' ? colors.textMuted : colors.primaryLight}
                  strokeWidth={1.5}
                />
              ))}

            {/* Trend Data Points in Trend-only Mode (when multiple points) */}
            {points.length > 1 && displayMode === 'trend' &&
              points.map((pt, i) => (
                <Circle
                  key={`trend-pt-${i}`}
                  cx={pt.x}
                  cy={pt.trendY}
                  r={scrubIndex === i ? 6 : 4}
                  fill={scrubIndex === i ? colors.primaryLight : colors.surface}
                  stroke={colors.primaryLight}
                  strokeWidth={2}
                />
              ))}

            {/* Active Vertical Cursor Scrub Line & Concentric Node Markers */}
            {activePoint && points.length > 1 && (
              <>
                {/* Glowing vertical cursor line spanning the chart height */}
                <Line
                  x1={activePoint.x}
                  y1={paddingTop - 6}
                  x2={activePoint.x}
                  y2={chartHeight - paddingBottom}
                  stroke={colors.primaryLight}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />

                {/* Trend marker halo */}
                <Circle
                  cx={activePoint.x}
                  cy={activePoint.trendY}
                  r={12}
                  fill={colors.primaryLight}
                  fillOpacity={0.22}
                />
                <Circle
                  cx={activePoint.x}
                  cy={activePoint.trendY}
                  r={5.5}
                  fill={colors.primaryLight}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />

                {/* Raw weigh-in marker halo */}
                {displayMode === 'both' && (
                  <>
                    <Circle
                      cx={activePoint.x}
                      cy={activePoint.rawY}
                      r={9}
                      fill={colors.amber}
                      fillOpacity={0.25}
                    />
                    <Circle
                      cx={activePoint.x}
                      cy={activePoint.rawY}
                      r={4.5}
                      fill={colors.amber}
                      stroke="#FFFFFF"
                      strokeWidth={1.8}
                    />
                  </>
                )}
              </>
            )}

            {/* Axis Date Labels */}
            {scopedWeights.length === 1 && (
              <SvgText
                x={layoutWidth / 2}
                y={chartHeight - 10}
                fill={colors.textMuted}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
              >
                {scopedWeights[0].date.slice(5)}
              </SvgText>
            )}
            {scopedWeights.length > 1 && (
              <>
                <SvgText
                  x={paddingLeft}
                  y={chartHeight - 10}
                  fill={colors.textMuted}
                  fontSize="10"
                  fontWeight="600"
                >
                  {scopedWeights[0].date.slice(5)}
                </SvgText>
                <SvgText
                  x={layoutWidth - paddingRight}
                  y={chartHeight - 10}
                  fill={colors.textMuted}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {scopedWeights[scopedWeights.length - 1].date.slice(5)}
                </SvgText>
              </>
            )}

            {/* Y-axis Min/Max Labels */}
            {hasValues && (
              <>
                <SvgText
                  x={layoutWidth - 6}
                  y={paddingTop + 4}
                  fill={colors.textMuted}
                  fontSize="9"
                  textAnchor="end"
                >
                  {Math.round(chartMax)}kg
                </SvgText>
                <SvgText
                  x={layoutWidth - 6}
                  y={chartHeight - paddingBottom - 2}
                  fill={colors.textMuted}
                  fontSize="9"
                  textAnchor="end"
                >
                  {Math.round(chartMin)}kg
                </SvgText>
              </>
            )}
          </Svg>

          {/* Empty Overlay when zero weights logged */}
          {points.length === 0 && (
            <View style={styles.chartEmptyOverlay} pointerEvents="none">
              <Scale size={24} color={colors.textMuted} />
              <Text style={styles.chartEmptyTitle}>No weigh-ins logged yet</Text>
              <Text style={styles.chartEmptySubtitle}>
                Tap &ldquo;Record Weigh-in&rdquo; to start your trend trajectory
              </Text>
            </View>
          )}

          {/* Interactive Tooltip Card Floating Above / Clamped */}
          {activePoint && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={[
                styles.chartTooltip,
                {
                  left: Math.max(12, Math.min(layoutWidth - 175, activePoint.x - 85)),
                },
              ]}
              pointerEvents="none"
            >
              <View style={styles.chartTooltipHeader}>
                <Calendar size={11} color={colors.primaryLight} />
                <Text style={styles.chartTooltipDate}>{activePoint.date}</Text>
              </View>

              <View style={styles.chartTooltipRow}>
                <Text style={styles.chartTooltipLabel}>Scale Weigh-in:</Text>
                <Text style={styles.chartTooltipRaw}>{activePoint.weight} kg</Text>
              </View>

              <View style={styles.chartTooltipRow}>
                <Text style={styles.chartTooltipLabel}>7d Moving Avg:</Text>
                <Text style={styles.chartTooltipTrend}>
                  {Math.round(activePoint.trend * 10) / 10} kg
                </Text>
                <Text
                  style={[
                    styles.chartTooltipVariance,
                    {
                      color:
                        activePoint.variance > 0
                          ? colors.amber
                          : activePoint.variance < 0
                            ? colors.cyan
                            : colors.textMuted,
                    },
                  ]}
                >
                  ({activePoint.variance > 0 ? `+${activePoint.variance}` : activePoint.variance})
                </Text>
              </View>

              {activeDeltaTarget != null && (
                <View style={styles.chartTooltipRow}>
                  <Text style={styles.chartTooltipLabel}>To Target ({targetWeight}kg):</Text>
                  <Text
                    style={[
                      styles.chartTooltipTargetDelta,
                      activeDeltaTarget <= 0 ? styles.textSuccess : styles.textWarning,
                    ]}
                  >
                    {activeDeltaTarget > 0 ? `+${activeDeltaTarget}` : activeDeltaTarget} kg
                  </Text>
                </View>
              )}

              {activeDeltaBaseline != null && activeDeltaBaseline !== 0 && (
                <View style={styles.chartTooltipRow}>
                  <Text style={styles.chartTooltipLabel}>Since start:</Text>
                  <Text
                    style={[
                      styles.chartTooltipTargetDelta,
                      activeDeltaBaseline < 0 ? styles.textSuccess : styles.textWarning,
                    ]}
                  >
                    {activeDeltaBaseline > 0 ? `+${activeDeltaBaseline}` : activeDeltaBaseline} kg
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// ==========================================
// 2. PR RECORDS SECTION (WITH CELEBRATION & LOGGING)
// ==========================================

function PrsSection({
  prs,
  allPrsCount,
  search,
  setSearch,
  selectedMuscle,
  setSelectedMuscle,
  isLoading,
  onCelebratePr,
  isLogging,
  setIsLogging,
  exerciseQuery,
  setExerciseQuery,
  searchedExercises,
  selectedExercise,
  setSelectedExercise,
  prWeight,
  setPrWeight,
  prReps,
  setPrReps,
  prDate,
  setPrDate,
  onSavePr,
  isSavingPr,
}: {
  prs: PersonalRecord[];
  allPrsCount: number;
  search: string;
  setSearch: (v: string) => void;
  selectedMuscle: string;
  setSelectedMuscle: (v: string) => void;
  isLoading: boolean;
  onCelebratePr: (pr: PrCelebrationData) => void;
  isLogging: boolean;
  setIsLogging: (v: boolean) => void;
  exerciseQuery: string;
  setExerciseQuery: (v: string) => void;
  searchedExercises: any[];
  selectedExercise: { id: string; name: string } | null;
  setSelectedExercise: (ex: { id: string; name: string } | null) => void;
  prWeight: string;
  setPrWeight: (v: string) => void;
  prReps: string;
  setPrReps: (v: string) => void;
  prDate: string;
  setPrDate: (v: string) => void;
  onSavePr: () => void;
  isSavingPr: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [showAllPrs, setShowAllPrs] = useState(false);
  const visiblePrs = showAllPrs ? prs : prs.slice(0, HISTORY_PAGE_SIZE);

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

      {/* Manual PR Recording Card Form */}
      {isLogging && (
        <Animated.View entering={enter(1)}>
          <Card elevated highlighted style={styles.logPrCard}>
            <View style={styles.formHeader}>
              <View style={styles.formTitleRow}>
                <Trophy size={18} color="#F59E0B" />
                <Text style={styles.formTitle}>Record New Personal Record</Text>
              </View>
              <PressableScale onPress={() => setIsLogging(false)}>
                <X size={18} color={colors.textMuted} />
              </PressableScale>
            </View>

            {/* Exercise Search & Selection */}
            <Text style={styles.prFieldLabel}>Exercise</Text>
            {selectedExercise ? (
              <View style={styles.selectedExercisePill}>
                <Text style={styles.selectedExerciseName}>{selectedExercise.name}</Text>
                <PressableScale onPress={() => setSelectedExercise(null)}>
                  <X size={16} color={colors.textMuted} />
                </PressableScale>
              </View>
            ) : (
              <View>
                <TextInput
                  placeholder="Type to search exercise (e.g. Bench, Squat)..."
                  placeholderTextColor={colors.textMuted}
                  value={exerciseQuery}
                  onChangeText={setExerciseQuery}
                  style={styles.prInput}
                />
                {searchedExercises.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.exerciseChipsScroll}
                  >
                    {searchedExercises.slice(0, 6).map((ex: any) => (
                      <PressableScale
                        key={ex.id}
                        onPress={() => {
                          setSelectedExercise({ id: ex.id, name: ex.name });
                          setExerciseQuery('');
                        }}
                        style={styles.exerciseChip}
                      >
                        <Text style={styles.exerciseChipText}>{ex.name}</Text>
                      </PressableScale>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <View style={styles.prInputsRow}>
              <View style={styles.flex2}>
                <Text style={styles.prFieldLabel}>Max Weight (kg)</Text>
                <TextInput
                  placeholder="e.g. 100"
                  placeholderTextColor={colors.textMuted}
                  value={prWeight}
                  onChangeText={setPrWeight}
                  keyboardType="decimal-pad"
                  style={styles.prInput}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.prFieldLabel}>Reps</Text>
                <TextInput
                  placeholder="e.g. 5"
                  placeholderTextColor={colors.textMuted}
                  value={prReps}
                  onChangeText={setPrReps}
                  keyboardType="number-pad"
                  style={styles.prInput}
                />
              </View>
              <View style={styles.flex2}>
                <Text style={styles.prFieldLabel}>Date</Text>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  value={prDate}
                  onChangeText={setPrDate}
                  style={styles.prInput}
                />
              </View>
            </View>

            <Button
              title="Save &amp; Celebrate PR"
              size="md"
              loading={isSavingPr}
              onPress={onSavePr}
              icon={<Sparkles size={16} color="#FFFFFF" />}
              iconPosition="right"
              style={styles.savePrBtn}
            />
          </Card>
        </Animated.View>
      )}

      {/* PR Cards Grid/List */}
      <Animated.View entering={enter(1)}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Personal Records ({prs.length})
          </Text>
          {!isLogging && (
            <PressableScale
              haptic="selection"
              onPress={() => setIsLogging(true)}
              style={styles.quickAddLink}
            >
              <Plus size={14} color={colors.primaryLight} />
              <Text style={styles.quickAddLinkText}>Log PR</Text>
            </PressableScale>
          )}
        </View>

        {prs.length === 0 ? (
          <EmptyState
            icon={<Trophy size={28} color={colors.warning} />}
            title="No records found"
            description={
              allPrsCount === 0
                ? 'Complete workouts with compound or isolation lifts, or tap Log PR above to record your personal bests!'
                : 'No PR matches your filter query.'
            }
          />
        ) : (
          <View style={styles.prList}>
            {visiblePrs.map((pr, idx) => (
              <Animated.View
                key={pr.id}
                entering={FadeInDown.delay(Math.min(idx, 8) * 50).duration(300)}
                layout={LinearTransition.duration(220)}
              >
                <PressableScale
                  haptic="selection"
                  onPress={() =>
                    onCelebratePr({
                      exercise_name: pr.exercise_name,
                      max_weight_kg: pr.max_weight_kg,
                      reps: pr.reps,
                      estimated_one_rep_max: pr.estimated_one_rep_max,
                      achieved_at: pr.achieved_at,
                      primary_muscle: pr.primary_muscle,
                    })
                  }
                  accessibilityLabel={`Celebrate PR for ${pr.exercise_name}`}
                >
                  <Card elevated style={styles.prItemCard}>
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
                      <View style={styles.prBadgeWrapper}>
                        <Badge
                          label={`e1RM ${Math.round(pr.estimated_one_rep_max || pr.max_weight_kg)} kg`}
                          tone="emerald"
                        />
                        <View style={styles.celebratePill}>
                          <Sparkles size={11} color="#F59E0B" />
                          <Text style={styles.celebratePillText}>Badge</Text>
                        </View>
                      </View>
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
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}

        {prs.length > HISTORY_PAGE_SIZE && (
          <PressableScale
            haptic="selection"
            onPress={() => setShowAllPrs((v) => !v)}
            style={styles.showMoreBtn}
            accessibilityLabel={showAllPrs ? 'Show fewer records' : 'Show all records'}
          >
            <Text style={styles.showMoreText}>
              {showAllPrs ? 'Show less' : `Show all ${prs.length} records`}
            </Text>
            {showAllPrs ? (
              <ChevronUp size={16} color={colors.primaryLight} />
            ) : (
              <ChevronDown size={16} color={colors.primaryLight} />
            )}
          </PressableScale>
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
  const { colors } = useTheme();
  const styles = useStyles();
  const [showAllLogs, setShowAllLogs] = useState(false);
  const visibleMeasurements = showAllLogs
    ? measurements
    : measurements.slice(0, HISTORY_PAGE_SIZE);
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
            {visibleMeasurements.map((entry) => (
              <ReanimatedSwipeable
                key={entry.id}
                friction={2}
                rightThreshold={48}
                overshootRight={false}
                onSwipeableOpen={(direction) => {
                  if (direction === 'left') {
                    haptics.medium();
                    onDelete(entry.id);
                  }
                }}
                renderRightActions={() => (
                  <View style={styles.swipeDelete}>
                    <Trash2 size={18} color="#FFFFFF" />
                    <Text style={styles.swipeDeleteText}>Delete</Text>
                  </View>
                )}
              >
              <Card elevated style={styles.mLogCard}>
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
              </ReanimatedSwipeable>
            ))}
          </View>
        )}

        {measurements.length > HISTORY_PAGE_SIZE && (
          <PressableScale
            haptic="selection"
            onPress={() => setShowAllLogs((v) => !v)}
            style={styles.showMoreBtn}
            accessibilityLabel={showAllLogs ? 'Show fewer entries' : 'Show all entries'}
          >
            <Text style={styles.showMoreText}>
              {showAllLogs ? 'Show less' : `Show all ${measurements.length} entries`}
            </Text>
            {showAllLogs ? (
              <ChevronUp size={16} color={colors.primaryLight} />
            ) : (
              <ChevronDown size={16} color={colors.primaryLight} />
            )}
          </PressableScale>
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
  const styles = useStyles();
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

