import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  Utensils,
  Coffee,
  Sun,
  Moon,
  Cookie,
  GlassWater,
  Plus,
  Trash2,
  Copy,
  History,
  ChevronDown,
  Flame,
  Dumbbell,
  ShieldCheck,
  TrendingUp,
  Zap,
  Pencil,
  Check,
  X,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/auth';
import { api, extractErrorMessage } from '../../src/api/client';
import { WeeklyNutritionProgress } from '../../src/components/nutrition/WeeklyNutritionProgress';
import { NutritionHeroCard } from '../../src/components/nutrition/NutritionHeroCard';
import { computeWeeklyNutritionSummaries } from '../../src/lib/nutritionWeeks';
import {
  Badge,
  Button,
  Card,
  DateNavigator,
  EmptyState,
  ErrorState,
  Input,
  PressableScale,
  ProgressBar,
  ProgressRing,
  ScreenHeader,
  ScreenSkeleton,
  Stepper,
  useToast,
  WaterCups,
} from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { formatNumber, calculateMacroPercentage } from '../../src/types';
import type { MealEntry, NutritionDayResponse, NutritionHistoryDay } from '../../src/types';
import { formatDayLabel, isValidDateKey, parseDateKey, shiftDateKey, toDateKey } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

const MEAL_ORDER: MealEntry['meal_type'][] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const CUP_ML = 250;

const MEAL_META: Record<MealEntry['meal_type'], { label: string; icon: typeof Coffee; color: 'amber' | 'primaryLight' | 'violet' | 'cyan' }> = {
  BREAKFAST: { label: 'Breakfast', icon: Coffee, color: 'amber' },
  LUNCH: { label: 'Lunch', icon: Sun, color: 'primaryLight' },
  DINNER: { label: 'Dinner', icon: Moon, color: 'violet' },
  SNACK: { label: 'Snacks', icon: Cookie, color: 'cyan' },
};

const enter = (i: number) => FadeInDown.delay(60 + i * 70).duration(420);

const NUTRITION_TABS = [
  { key: 'DAILY' as const, label: 'Daily Fuel', icon: Utensils },
  { key: 'WEEKLY' as const, label: 'Weekly Nutrients', icon: TrendingUp },
];

export default function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const bottomClearance = useTabBarClearance();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(() => (isValidDateKey(params.date) ? params.date : toDateKey(new Date())));

  // Deep links from the dashboard week strip pass ?date=YYYY-MM-DD; follow them when they change.
  const [linkedDate, setLinkedDate] = useState(params.date);
  if (params.date !== linkedDate) {
    setLinkedDate(params.date);
    if (isValidDateKey(params.date)) setDate(params.date);
  }

  const [historyDaysCount, setHistoryDaysCount] = useState(5);
  const [viewMode, setViewMode] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [isEditingWater, setIsEditingWater] = useState(false);
  const [customWaterInput, setCustomWaterInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const queryKey = ['nutritionDay', date];
  const {
    data: nutritionData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    isPlaceholderData,
  } = useQuery({
    queryKey,
    queryFn: () => api.getNutrition(date),
    placeholderData: (prev) => prev,
  });

  const {
    data: historyData,
    refetch: refetchHistory,
    isRefetching: isHistoryRefetching,
  } = useQuery({
    queryKey: ['nutritionHistory', Math.max(30, historyDaysCount)],
    queryFn: () => api.getNutritionHistory(Math.max(30, historyDaysCount)),
    placeholderData: (prev) => prev,
  });

  const waterMutation = useMutation({
    mutationFn: (ml: number) => api.updateWater(date, ml),
    onMutate: async (ml) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NutritionDayResponse>(queryKey);
      if (previous) {
        queryClient.setQueryData<NutritionDayResponse>(queryKey, {
          ...previous,
          day: { ...previous.day, water_consumed_ml: ml },
        });
      }
      return { previous };
    },
    onError: (err, _ml, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      haptics.error();
      Alert.alert("Couldn't update water", extractErrorMessage(err));
    },
    onSettled: () => invalidateTrackingData(queryClient),
  });

  // Delete right away (optimistically) and offer Undo, instead of a confirm dialog per entry.
  const deleteMutation = useMutation({
    mutationFn: (meal: MealEntry) => api.deleteMeal(meal.id),
    onMutate: async (meal) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NutritionDayResponse>(queryKey);
      if (previous?.day) {
        queryClient.setQueryData<NutritionDayResponse>(queryKey, {
          ...previous,
          day: { ...previous.day, meals: previous.day.meals.filter((m) => m.id !== meal.id) },
        });
      }
      return { previous };
    },
    onSuccess: (_res, meal) => {
      haptics.success();
      toast({ message: `Deleted ${meal.name}`, actionLabel: 'Undo', onAction: () => restoreMutation.mutate(meal) });
    },
    onError: (err, _meal, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      haptics.error();
      Alert.alert("Couldn't delete entry", extractErrorMessage(err));
    },
    onSettled: () => invalidateTrackingData(queryClient),
  });

  const restoreMutation = useMutation({
    mutationFn: (meal: MealEntry) =>
      api.addMeal({
        date,
        meal_type: meal.meal_type,
        name: meal.name,
        ...(meal.food
          ? { food: meal.food, servings: meal.servings ?? 1 }
          : { calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g }),
      }),
    onError: (err) => Alert.alert("Couldn't restore entry", extractErrorMessage(err)),
    onSettled: () => invalidateTrackingData(queryClient),
  });

  const repeatMutation = useMutation({
    mutationFn: () => api.repeatYesterday(date),
    onSuccess: (res) => {
      haptics.success();
      Alert.alert('Meals copied', `${res.copied_count} entries copied from the previous day.`);
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't copy meals", extractErrorMessage(err));
    },
    onSettled: () => invalidateTrackingData(queryClient),
  });

  const onRefresh = async () => {
    haptics.light();
    await Promise.all([refetch(), refetchHistory()]);
  };

  const openAddMeal = (mealType?: MealEntry['meal_type'], targetDate?: string, mode?: string) =>
    router.push({
      pathname: '/meal/add',
      params: {
        date: targetDate || date,
        ...(mealType ? { type: mealType } : {}),
        ...(mode ? { mode } : {}),
      },
    });

  const openMeal = (meal: MealEntry) => router.push({ pathname: '/meal/[id]', params: { id: meal.id, date } });

  const day = nutritionData?.day;
  const targets = nutritionData?.targets;
  const previousDayMeals = nutritionData?.yesterday_meals ?? [];
  const todayKey = toDateKey(new Date());
  const historyDays = historyData?.history ?? [];

  const plan = nutritionData?.plan;
  const planMode = plan?.mode || (historyData?.program?.mode as any) || (user?.profile?.fitness_goal === 'FAT_LOSS' ? 'CUT' : (user?.profile?.fitness_goal === 'HYPERTROPHY' || user?.profile?.fitness_goal === 'STRENGTH') ? 'BULK' : 'CUT');
  const targetType: 'MAX' | 'MIN' | 'TARGET' = plan?.target_type || (planMode === 'BULK' ? 'MIN' : planMode === 'CUT' ? 'MAX' : 'TARGET');
  const isBulk = targetType === 'MIN' || planMode === 'BULK';
  const isCut = targetType === 'MAX' || planMode === 'CUT';

  const weeklySummaries = useMemo(() => {
    return computeWeeklyNutritionSummaries(historyDays, targets, planMode);
  }, [historyDays, targets, planMode]);
  const thisWeek = weeklySummaries[0];
  const displayedHistoryDays = useMemo(() => {
    return historyDays.slice(0, historyDaysCount);
  }, [historyDays, historyDaysCount]);

  const mealGroups = useMemo(() => {
    const meals = day?.meals || [];
    return MEAL_ORDER.map((type) => {
      const items = meals.filter((m) => m.meal_type === type);
      return { type, items, calories: items.reduce((sum, m) => sum + (m.calories || 0), 0) };
    }).filter((g) => g.items.length > 0);
  }, [day?.meals]);

  const isToday = formatDayLabel(date) === 'Today';
  const metMacrosRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    // Only celebrate hitting a macro target while looking at today's live totals,
    // not while browsing history (which would replay the tick on every date switch).
    if (!isToday) {
      metMacrosRef.current = {};
      return;
    }
    const macroValues = [
      { label: 'Protein', consumed: day?.total_protein || 0, target: targets?.protein_g || 160 },
      { label: 'Carbs', consumed: day?.total_carbs || 0, target: targets?.carbs_g || 240 },
      { label: 'Fat', consumed: day?.total_fat || 0, target: targets?.fat_g || 65 },
    ];
    let justMet = false;
    macroValues.forEach((m) => {
      const met = m.target > 0 && m.consumed >= m.target;
      if (met && !metMacrosRef.current[m.label]) justMet = true;
      metMacrosRef.current[m.label] = met;
    });
    if (justMet) haptics.success();
  }, [isToday, day?.total_protein, day?.total_carbs, day?.total_fat, targets?.protein_g, targets?.carbs_g, targets?.fat_g]);

  if (isLoading && !nutritionData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenSkeleton />
      </SafeAreaView>
    );
  }

  if (isError && !nutritionData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ErrorState
          title="Couldn't load nutrition"
          message={extractErrorMessage(error)}
          onRetry={onRefresh}
          retrying={isRefetching}
        />
      </SafeAreaView>
    );
  }

  const caloriesConsumed = day?.total_calories || 0;
  const exerciseCalories = targets?.exercise_calories || 0;
  const caloriesTarget = (targets?.daily_calories || 2200) + exerciseCalories;
  const calPct = calculateMacroPercentage(caloriesConsumed, caloriesTarget);
  const caloriesLeft = caloriesTarget - caloriesConsumed;

  let ringPct = Math.min(100, Math.max(0, calPct));
  let ringColor = colors.primaryLight;
  let ringGradient = colors.cyan;
  let ringValue = formatNumber(Math.abs(caloriesLeft));
  let ringLabel = caloriesLeft >= 0 ? 'kcal remaining' : 'kcal over';
  let ringValueColor: string | undefined = undefined;
  let ringLabelColor: string | undefined = caloriesLeft < 0 ? colors.warning : undefined;
  let statStatusValue = `${calPct}%`;
  let statAccent = true;

  if (isBulk) {
    if (caloriesConsumed < caloriesTarget) {
      const kcalNeeded = caloriesTarget - caloriesConsumed;
      ringPct = Math.min(100, Math.max(0, calPct));
      ringColor = colors.amber;
      ringGradient = colors.primaryLight;
      ringValue = formatNumber(kcalNeeded);
      ringLabel = 'kcal needed (min)';
      ringLabelColor = colors.amber;
      statStatusValue = `${calPct}% of min`;
      statAccent = false;
    } else {
      const surplus = caloriesConsumed - caloriesTarget;
      ringPct = 100;
      ringColor = colors.success;
      ringGradient = colors.cyan;
      ringValue = surplus > 0 ? `+${formatNumber(surplus)}` : 'Hit!';
      ringValueColor = colors.success;
      ringLabel = 'kcal surplus · Min met 🎉';
      ringLabelColor = colors.success;
      statStatusValue = 'Min Met';
      statAccent = true;
    }
  } else if (isCut) {
    if (caloriesConsumed <= caloriesTarget) {
      ringPct = Math.min(100, Math.max(0, calPct));
      ringColor = colors.primaryLight;
      ringGradient = colors.cyan;
      ringValue = formatNumber(caloriesLeft);
      ringLabel = 'kcal left (max)';
      statStatusValue = `${calPct}% (Under)`;
      statAccent = true;
    } else {
      const over = caloriesConsumed - caloriesTarget;
      ringPct = 100;
      ringColor = colors.warning;
      ringGradient = colors.rose;
      ringValue = formatNumber(over);
      ringValueColor = colors.warning;
      ringLabel = 'kcal over deficit max';
      ringLabelColor = colors.warning;
      statStatusValue = 'Over Max';
      statAccent = false;
    }
  }

  const macros = [
    {
      label: 'Protein',
      sublabel: isCut ? 'Shield (2.1g/kg)' : isBulk ? 'Growth (1.8g/kg)' : undefined,
      consumed: day?.total_protein || 0,
      target: targets?.protein_g || 160,
      color: colors.cyan,
    },
    { label: 'Carbs', consumed: day?.total_carbs || 0, target: targets?.carbs_g || 240, color: colors.amber },
    { label: 'Fat', consumed: day?.total_fat || 0, target: targets?.fat_g || 65, color: colors.violet },
  ];

  const waterMl = day?.water_consumed_ml || 0;
  const waterTargetMl = targets?.water_ml || 2500;
  const waterTargetCups = Math.max(1, Math.round(waterTargetMl / CUP_ML));
  const waterCups = Math.round(waterMl / CUP_ML);
  const dayLabel = formatDayLabel(date);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
            colors={[colors.primaryLight]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScreenHeader
          eyebrow="Fuel"
          title="Nutrition"
          right={
            <PressableScale
              onPress={() => openAddMeal()}
              style={styles.headerAddBtn}
              accessibilityLabel="Log food"
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
            </PressableScale>
          }
        />

        {/* Tabs */}
        <Animated.View entering={enter(0)} style={styles.tabsRow}>
          {NUTRITION_TABS.map((tab) => {
            const active = tab.key === viewMode;
            const Icon = tab.icon;
            return (
              <PressableScale
                key={tab.key}
                onPress={() => {
                  haptics.selection();
                  setViewMode(tab.key);
                }}
                style={[styles.tabItem, active && styles.tabItemActive]}
                accessibilityLabel={tab.key === 'DAILY' ? 'Daily Fuel log' : 'Weekly Nutrients and progress'}
              >
                <Icon
                  size={16}
                  color={active ? colors.primaryLight : colors.textMuted}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.key === 'WEEKLY' && thisWeek && thisWeek.logged_count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {thisWeek.logged_count}/7d
                    </Text>
                  </View>
                )}
              </PressableScale>
            );
          })}
        </Animated.View>

        {viewMode === 'WEEKLY' ? (
          <WeeklyNutritionProgress
            history={historyDays}
            targets={targets}
            planMode={planMode}
            targetType={targetType}
            selectedDate={date}
            onSelectDate={(newDate) => {
              setDate(newDate);
              setViewMode('DAILY');
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
            onLogMealForDate={(targetDate) => {
              openAddMeal(undefined, targetDate);
            }}
          />
        ) : (
          <>
            <DateNavigator date={date} onChange={setDate} />

        {/* Plan Mode & Target Banner */}
        <Animated.View entering={enter(0)}>
          <Card style={styles.planBannerCard}>
            <View style={styles.planBannerRow}>
              <View
                style={[
                  styles.planBannerIcon,
                  { backgroundColor: isBulk ? `${colors.amber}20` : isCut ? `${colors.primaryLight}20` : `${colors.cyan}20` },
                ]}
              >
                {isBulk ? (
                  <Dumbbell size={18} color={colors.amber} />
                ) : isCut ? (
                  <Flame size={18} color={colors.primaryLight} />
                ) : (
                  <ShieldCheck size={18} color={colors.cyan} />
                )}
              </View>
              <View style={styles.planBannerInfo}>
                <View style={styles.planBannerTitleRow}>
                  <Text style={styles.planBannerTitle}>
                    {isBulk ? 'Bulk Plan · Surplus Floor' : isCut ? 'Cut Plan · Deficit Ceiling' : 'Maintenance Plan'}
                  </Text>
                  <Badge
                    label={isBulk ? 'Min Target' : isCut ? 'Deficit Max' : 'Target'}
                    tone={isBulk ? 'amber' : isCut ? 'cyan' : 'slate'}
                  />
                </View>
                <Text style={styles.planBannerDesc}>
                  {isBulk
                    ? `Eat at least ${formatNumber(caloriesTarget)} kcal with ${targets?.protein_g || 160}g protein to maximize muscle growth.`
                    : isCut
                    ? `Stay under ${formatNumber(caloriesTarget)} kcal while hitting ${targets?.protein_g || 160}g protein to protect lean muscle.`
                    : `Aim for ${formatNumber(caloriesTarget)} kcal and ${targets?.protein_g || 160}g protein daily.`}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Calorie hero */}
        <Animated.View entering={enter(1)}>
          <NutritionHeroCard
            headerTitle={isCut ? 'Daily Deficit Track' : isBulk ? 'Daily Muscle Surplus' : 'Daily Energy Balance'}
            headerSubtitle={planMode ? `${planMode} TARGET` : 'CALORIE GOAL'}
            headerIcon={
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isBulk ? `${colors.amber}22` : isCut ? `${colors.primaryLight}22` : `${colors.cyan}22`,
                }}
              >
                {isBulk ? (
                  <Dumbbell size={16} color={colors.amber} />
                ) : isCut ? (
                  <Flame size={16} color={colors.primaryLight} />
                ) : (
                  <ShieldCheck size={16} color={colors.cyan} />
                )}
              </View>
            }
            headerBadgeLabel={isBulk ? 'Surplus Target' : isCut ? 'Deficit Max' : 'Daily Goal'}
            headerBadgeTone={isBulk ? 'amber' : isCut ? 'emerald' : 'cyan'}
            percentage={ringPct}
            gaugeColor={ringColor}
            gaugeGradient={ringGradient}
            centerIcon={
              isBulk ? (
                <Dumbbell size={14} color={colors.amber} />
              ) : isCut ? (
                <Flame size={14} color={colors.primaryLight} />
              ) : (
                <ShieldCheck size={14} color={colors.cyan} />
              )
            }
            primaryValue={ringValue}
            primaryValueColor={ringValueColor}
            primaryLabel={ringLabel}
            statusBadgeText={statStatusValue}
            statusBadgeTone={
              isCut
                ? caloriesLeft < 0
                  ? 'rose'
                  : 'emerald'
                : isBulk
                ? caloriesConsumed >= caloriesTarget
                  ? 'emerald'
                  : 'amber'
                : caloriesLeft < 0
                ? 'rose'
                : 'cyan'
            }
            stats={[
              {
                label: 'Eaten',
                value: formatNumber(caloriesConsumed),
                unit: 'kcal',
                icon: <Utensils size={11} color={colors.primaryLight} />,
              },
              {
                label: isBulk ? 'Min Target' : isCut ? 'Max Deficit' : 'Goal',
                value: formatNumber(caloriesTarget),
                unit: 'kcal',
                icon: <ShieldCheck size={11} color={colors.cyan} />,
                badgeText: exerciseCalories > 0 ? `+${formatNumber(exerciseCalories)} earned` : undefined,
                badgeTone: exerciseCalories > 0 ? 'rose' : undefined,
              },
              {
                label: isBulk ? (caloriesConsumed >= caloriesTarget ? 'Surplus' : 'Remaining') : isCut ? 'Deficit' : 'Balance',
                value: statStatusValue,
                highlight: true,
                accentColor: statAccent ? (isCut && caloriesLeft < 0 ? colors.rose : colors.primaryLight) : undefined,
                badgeTone: isCut ? (caloriesLeft < 0 ? 'rose' : 'emerald') : isBulk ? (caloriesConsumed >= caloriesTarget ? 'emerald' : 'amber') : 'cyan',
                badgeText: isCut ? (caloriesLeft >= 0 ? 'On Track' : 'Over Limit') : isBulk ? (caloriesConsumed >= caloriesTarget ? 'Surplus Met' : 'In Progress') : 'Tracking',
                icon: <TrendingUp size={11} color={statAccent ? (isCut && caloriesLeft < 0 ? colors.rose : colors.primaryLight) : colors.textMuted} />,
              },
            ]}
          />
        </Animated.View>

        {/* Macro rings */}
        <Animated.View entering={enter(2)} style={styles.macroRow}>
          {macros.map((m, i) => {
            const pct = calculateMacroPercentage(m.consumed, m.target);
            return (
              <View
                key={m.label}
                style={styles.macroTile}
                accessible
                accessibilityLabel={`${m.label}: ${formatNumber(m.consumed)} of ${formatNumber(m.target)} grams`}
              >
                <ProgressRing
                  percentage={pct}
                  size={68}
                  strokeWidth={7}
                  color={m.color}
                  delay={350 + i * 100}
                >
                  <Text style={styles.macroPct}>{pct}%</Text>
                </ProgressRing>
                <Text style={styles.macroLabel}>{m.label}</Text>
                {m.sublabel ? (
                  <Text style={styles.macroSublabel}>{m.sublabel}</Text>
                ) : null}
                <Text style={styles.macroValue}>
                  {formatNumber(m.consumed)}
                  <Text style={styles.macroTarget}> / {formatNumber(m.target)}g</Text>
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {/* Water */}
        <Animated.View entering={enter(2)}>
          <Card style={styles.waterCard}>
            <View style={styles.waterHeader}>
              <View style={styles.waterTitleRow}>
                <View style={styles.waterIcon}>
                  <GlassWater size={16} color={colors.blue} />
                </View>
                <Text style={styles.waterTitle}>Hydration</Text>
              </View>
              <View style={styles.waterAmountRow}>
                <PressableScale
                  haptic="selection"
                  onPress={() => {
                    setCustomWaterInput(String(waterMl));
                    setIsEditingWater((prev) => !prev);
                  }}
                  style={styles.waterAmountBtn}
                  accessibilityLabel="Tap to set exact water amount"
                >
                  <Text style={styles.waterAmount}>
                    {(waterMl / 1000).toFixed(2)}
                    <Text style={styles.waterAmountTarget}> / {(waterTargetMl / 1000).toFixed(1)} L</Text>
                  </Text>
                  <Pencil size={12} color={colors.textMuted} />
                </PressableScale>
                <ProgressRing
                  percentage={Math.min(100, Math.round((waterMl / Math.max(1, waterTargetMl)) * 100))}
                  size={32}
                  strokeWidth={3.5}
                  color={colors.blue}
                  gradientTo={colors.cyan}
                />
              </View>
            </View>

            {isEditingWater && (
              <Animated.View entering={FadeInDown.duration(160)} style={styles.waterCustomRow}>
                <Input
                  label="Exact Water (ml)"
                  keyboardType="number-pad"
                  placeholder="e.g. 2000"
                  value={customWaterInput}
                  onChangeText={(t) => setCustomWaterInput(t.replace(/[^0-9]/g, ''))}
                  containerStyle={styles.waterCustomInput}
                  autoFocus
                />
                <PressableScale
                  haptic="medium"
                  onPress={() => {
                    const parsed = parseInt(customWaterInput, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      waterMutation.mutate(parsed);
                    }
                    setIsEditingWater(false);
                  }}
                  style={styles.waterSaveBtn}
                  accessibilityLabel="Save exact water amount"
                >
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                </PressableScale>
                <PressableScale
                  haptic="selection"
                  onPress={() => setIsEditingWater(false)}
                  style={styles.waterCancelBtn}
                  accessibilityLabel="Cancel editing water"
                >
                  <X size={16} color={colors.textSecondary} />
                </PressableScale>
              </Animated.View>
            )}

            {/* Quick Bottle Presets */}
            <View style={styles.waterPresetsRow}>
              <PressableScale
                haptic="selection"
                onPress={() => waterMutation.mutate(waterMl + 250)}
                style={styles.waterPresetChip}
                accessibilityLabel="Add 250ml cup"
              >
                <Text style={styles.waterPresetPlus}>+</Text>
                <Text style={styles.waterPresetAmount}>250ml</Text>
                <Text style={styles.waterPresetLabel}>Cup</Text>
              </PressableScale>

              <PressableScale
                haptic="selection"
                onPress={() => waterMutation.mutate(waterMl + 500)}
                style={[styles.waterPresetChip, styles.waterPresetHighlight]}
                accessibilityLabel="Add 500ml shaker"
              >
                <Text style={[styles.waterPresetPlus, { color: colors.blue }]}>+</Text>
                <Text style={[styles.waterPresetAmount, { color: colors.blue }]}>500ml</Text>
                <Text style={styles.waterPresetLabel}>Shaker</Text>
              </PressableScale>

              <PressableScale
                haptic="selection"
                onPress={() => waterMutation.mutate(waterMl + 750)}
                style={styles.waterPresetChip}
                accessibilityLabel="Add 750ml bottle"
              >
                <Text style={styles.waterPresetPlus}>+</Text>
                <Text style={styles.waterPresetAmount}>750ml</Text>
                <Text style={styles.waterPresetLabel}>Bottle</Text>
              </PressableScale>

              <PressableScale
                haptic="selection"
                onPress={() => waterMutation.mutate(waterMl + 1000)}
                style={styles.waterPresetChip}
                accessibilityLabel="Add 1000ml flask"
              >
                <Text style={styles.waterPresetPlus}>+</Text>
                <Text style={styles.waterPresetAmount}>1000ml</Text>
                <Text style={styles.waterPresetLabel}>Flask</Text>
              </PressableScale>

              {waterMl > 0 && (
                <PressableScale
                  haptic="selection"
                  onPress={() => waterMutation.mutate(Math.max(0, waterMl - 250))}
                  style={[styles.waterPresetChip, styles.waterPresetUndo]}
                  accessibilityLabel="Undo 250ml"
                >
                  <Text style={styles.waterPresetUndoText}>−250ml</Text>
                </PressableScale>
              )}
            </View>

            <View style={styles.waterControls}>
              <Text style={styles.waterHint}>
                {waterCups} of {waterTargetCups} cups · {CUP_ML} ml each
              </Text>
              <Stepper
                label="a cup of water"
                accentColor={colors.blue}
                disabled={isPlaceholderData}
                canDecrement={waterMl > 0}
                onDecrement={() => waterMutation.mutate(Math.max(0, waterMl - CUP_ML))}
                onIncrement={() => waterMutation.mutate(waterMl + CUP_ML)}
              />
            </View>
            <View style={styles.cupsRow}>
              <WaterCups
                cups={waterCups}
                targetCups={waterTargetCups}
                maxDisplay={12}
                accentColor={colors.blue}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Meals */}
        <Animated.View entering={enter(3)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{isToday ? "Today's meals" : `Meals · ${dayLabel}`}</Text>
            <View style={styles.sectionHeaderRight}>
              {mealGroups.length > 0 && (
                <Text style={styles.sectionMeta}>{day?.meals?.length ?? 0} entries</Text>
              )}
              <PressableScale
                haptic="selection"
                onPress={() => openAddMeal(undefined, date, 'quick')}
                style={styles.headerQuickAddChip}
                accessibilityLabel="Quick add food or calories"
              >
                <Zap size={12} color={colors.amber} />
                <Text style={styles.headerQuickAddText}>Quick Add</Text>
              </PressableScale>
            </View>
          </View>
        </Animated.View>

        {mealGroups.length > 0 ? (
          mealGroups.map((group, gi) => {
            const meta = MEAL_META[group.type] ?? MEAL_META.SNACK;
            const Icon = meta.icon;
            return (
              <Animated.View key={group.type} entering={enter(4 + gi)}>
                <Card style={styles.mealGroupCard}>
                  <View style={styles.mealGroupHeader}>
                    <View style={[styles.mealGroupIcon, { backgroundColor: `${colors[meta.color]}22` }]}>
                      <Icon size={16} color={colors[meta.color]} />
                    </View>
                    <Text style={styles.mealGroupTitle}>{meta.label}</Text>
                    <Text style={styles.mealGroupKcal}>{formatNumber(group.calories)} kcal</Text>
                    <PressableScale
                      haptic="selection"
                      onPress={() => openAddMeal(group.type, date, 'quick')}
                      style={styles.groupQuickAddBtn}
                      accessibilityLabel={`Quick add calories to ${meta.label}`}
                    >
                      <Zap size={14} color={colors.amber} />
                    </PressableScale>
                    <PressableScale
                      haptic="selection"
                      onPress={() => openAddMeal(group.type)}
                      style={styles.groupAddBtn}
                      accessibilityLabel={`Add to ${meta.label}`}
                    >
                      <Plus size={16} color={colors.primaryLight} />
                    </PressableScale>
                  </View>

                  {group.items.map((meal, mi) => (
                    <Animated.View
                      key={meal.id}
                      entering={FadeInDown.delay(mi * 40).duration(280)}
                      layout={LinearTransition.duration(220)}
                    >
                      <MealRow
                        meal={meal}
                        bordered={mi > 0}
                        disabled={isPlaceholderData}
                        onOpen={() => openMeal(meal)}
                        onDelete={() => deleteMutation.mutate(meal)}
                      />
                    </Animated.View>
                  ))}
                </Card>
              </Animated.View>
            );
          })
        ) : (
          <EmptyState
            title={isToday ? 'No meals logged yet' : `Nothing logged for ${dayLabel}`}
            description="Log your meals to track calories and macros against your daily targets."
            icon={<Utensils size={24} color={colors.primaryLight} />}
            action={
              <View style={styles.emptyActions}>
                <Button
                  title="Log food"
                  size="sm"
                  icon={<Plus size={16} color="#FFFFFF" />}
                  iconPosition="left"
                  onPress={() => openAddMeal()}
                />
                {previousDayMeals.length > 0 && (
                  <Button
                    title={`Copy previous day (${previousDayMeals.length})`}
                    size="sm"
                    variant="secondary"
                    loading={repeatMutation.isPending}
                    icon={<Copy size={16} color={colors.textPrimary} />}
                    iconPosition="left"
                    onPress={() => repeatMutation.mutate()}
                  />
                )}
              </View>
            }
          />
        )}

        {mealGroups.length > 0 && (
          <Button
            title="Log food"
            variant="outline"
            icon={<Plus size={18} color={colors.primaryLight} />}
            iconPosition="left"
            onPress={() => openAddMeal()}
            style={styles.addMoreBtn}
          />
        )}

        {/* Daily Nutrition History Stream */}
        <Animated.View entering={enter(4)}>
          <View style={styles.historySectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.historyTitleRow}>
                <History size={18} color={colors.primaryLight} />
                <Text style={styles.sectionTitle}>Daily Nutrition History</Text>
              </View>
              <Text style={styles.historySubhead}>
                Last {historyDaysCount} days · {formatDayLabel(shiftDateKey(todayKey, -(historyDaysCount - 1)))} to Today
              </Text>
            </View>
          </View>
        </Animated.View>

        {displayedHistoryDays.map((item, i) => (
          <Animated.View key={item.date} entering={enter(5 + Math.min(i, 5))}>
            <NutritionHistoryCard
              item={item}
              isSelected={item.date === date}
              activePlanMode={planMode}
              activeTargetType={targetType}
              onSelect={() => {
                haptics.selection();
                setDate(item.date);
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              onLogMeal={() => openAddMeal(undefined, item.date)}
            />
          </Animated.View>
        ))}

        {/* Load more (10 days at a time) */}
        <Animated.View entering={enter(5)} style={styles.historyActionsRow}>
          <Button
            title="View more history (+10 days)"
            variant="secondary"
            icon={<ChevronDown size={16} color={colors.textPrimary} />}
            iconPosition="right"
            onPress={() => {
              haptics.selection();
              setHistoryDaysCount((c) => c + 10);
            }}
            style={{ flex: 1 }}
          />
          {historyDaysCount > 5 && (
            <Button
              title="Show 5 days"
              variant="ghost"
              onPress={() => {
                haptics.selection();
                setHistoryDaysCount(5);
              }}
              style={{ marginLeft: spacing.xs }}
            />
          )}
        </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MealRow({
  meal,
  bordered,
  disabled,
  onOpen,
  onDelete,
}: {
  meal: MealEntry;
  bordered: boolean;
  disabled: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      enabled={!disabled}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
          haptics.medium();
          onDelete();
        }
      }}
      renderRightActions={() => (
        <View style={styles.swipeDelete}>
          <Trash2 size={18} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </View>
      )}
    >
      <View style={[styles.mealRow, bordered && styles.mealRowBorder]}>
        <PressableScale
          haptic="selection"
          scaleTo={0.99}
          onPress={onOpen}
          disabled={disabled}
          style={styles.mealRowClickable}
          accessibilityLabel={`${meal.name}, ${formatNumber(meal.calories)} calories. Tap to edit`}
        >
          <View style={styles.mealInfo}>
            <Text style={styles.mealName} numberOfLines={1}>
              {meal.name}
            </Text>
            <View style={styles.macroChips}>
              <MacroChip letter="P" value={meal.protein_g} color={colors.cyan} />
              <MacroChip letter="C" value={meal.carbs_g} color={colors.amber} />
              <MacroChip letter="F" value={meal.fat_g} color={colors.violet} />
              {meal.servings ? (
                <Text style={styles.servingsTag}>
                  {meal.servings} {meal.servings === 1 ? 'serving' : 'servings'}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.mealCalories}>{formatNumber(meal.calories)}</Text>
        </PressableScale>

        <PressableScale
          haptic="light"
          onPress={onDelete}
          disabled={disabled}
          style={styles.deleteBtn}
          accessibilityLabel={`Delete ${meal.name}`}
        >
          <Trash2 size={16} color={colors.textMuted} />
        </PressableScale>
      </View>
    </ReanimatedSwipeable>
  );
}


function MacroChip({ letter, value, color }: { letter: string; value: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.macroChip}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroChipText}>
        {letter} {formatNumber(value)}g
      </Text>
    </View>
  );
}

function NutritionHistoryCard({
  item,
  isSelected,
  activePlanMode,
  activeTargetType,
  onSelect,
  onLogMeal,
}: {
  item: NutritionHistoryDay;
  isSelected: boolean;
  activePlanMode?: string;
  activeTargetType?: 'MAX' | 'MIN' | 'TARGET';
  onSelect: () => void;
  onLogMeal: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const parsed = parseDateKey(item.date);
  const dayOfMonth = parsed.getDate();
  const monthShort = parsed.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short' });
  const todayKey = toDateKey(new Date());
  const isToday = item.date === todayKey;
  const isYesterday = item.date === shiftDateKey(todayKey, -1);

  const calConsumed = item.total_calories || 0;
  const calTarget = item.target_calories || 2200;
  const pct = Math.round((calConsumed / Math.max(1, calTarget)) * 100);
  const calDiff = calConsumed - calTarget;

  const itemMode = item.mode || activePlanMode || 'CUT';
  const itemTargetType = item.target_type || activeTargetType || (itemMode === 'BULK' ? 'MIN' : itemMode === 'CUT' ? 'MAX' : 'TARGET');
  const isItemBulk = itemTargetType === 'MIN' || itemMode === 'BULK';
  const isItemCut = itemTargetType === 'MAX' || itemMode === 'CUT';

  const targetProtein = item.target_protein || 160;
  const targetCarbs = item.target_carbs || 240;
  const targetFat = item.target_fat || 65;
  const targetWater = item.target_water || 2500;
  const isProteinMet = item.total_protein >= targetProtein;
  const proteinPct = Math.round((item.total_protein / Math.max(1, targetProtein)) * 100);

  const renderBadge = () => {
    if (isSelected) {
      return <Badge label="Viewing" tone="cyan" />;
    }
    if (!item.has_logged) {
      return <Badge label="Open Day" tone="slate" />;
    }
    if (isItemBulk) {
      if (calConsumed >= calTarget) {
        if (calDiff > 500) {
          return <Badge label={`+${formatNumber(calDiff)} kcal (high surplus)`} tone="amber" />;
        }
        return <Badge label={calDiff === 0 ? 'Min Target Met' : `+${formatNumber(calDiff)} surplus met`} tone="emerald" />;
      }
      const needed = calTarget - calConsumed;
      if (needed <= 150) {
        return <Badge label={`${formatNumber(needed)} kcal to min`} tone="emerald" />;
      }
      return <Badge label={`${formatNumber(needed)} kcal needed (min)`} tone="amber" />;
    }
    if (isItemCut) {
      if (calDiff > 0) {
        return <Badge label={`${formatNumber(calDiff)} kcal over deficit`} tone="amber" />;
      }
      const under = Math.abs(calDiff);
      if (under <= 100) {
        return <Badge label="On Deficit Target" tone="emerald" />;
      }
      return <Badge label={`${formatNumber(under)} kcal under max`} tone="cyan" />;
    }
    // Balanced
    if (calDiff >= -150 && calDiff <= 150) {
      return <Badge label="On Target" tone="emerald" />;
    }
    if (calDiff > 150) {
      return <Badge label={`${formatNumber(calDiff)} kcal over`} tone="amber" />;
    }
    return <Badge label={`${formatNumber(Math.abs(calDiff))} kcal left`} tone="cyan" />;
  };

  const getBarColor = () => {
    if (pct === 0) return 'transparent';
    if (isItemBulk) {
      if (pct >= 100) return pct > 125 ? colors.amber : colors.success;
      if (pct >= 80) return colors.primaryLight;
      return colors.amber;
    }
    if (isItemCut) {
      if (pct > 105) return colors.warning;
      if (pct >= 85) return colors.primaryLight;
      return colors.cyan;
    }
    return pct > 110 ? colors.warning : pct >= 85 ? colors.primaryLight : colors.cyan;
  };

  return (
    <Card elevated style={[styles.historyCard, isSelected && styles.historyCardSelected]}>
      <PressableScale
        haptic="selection"
        scaleTo={0.99}
        onPress={onSelect}
        style={styles.historyCardPressable}
        accessibilityLabel={`Nutrition for ${item.date}. ${calConsumed} of ${calTarget} calories. Tap to view.`}
      >
        <View style={styles.historyCardTopRow}>
          {/* Left Date Tile */}
          <View style={[styles.historyDateTile, isSelected && styles.historyDateTileActive]}>
            <Text style={styles.historyDateMonth}>{monthShort}</Text>
            <Text style={styles.historyDateDay}>{dayOfMonth}</Text>
            {item.program_day_number ? (
              <View style={styles.historyProgDayBadge}>
                <Text style={styles.historyProgDayText}>D{item.program_day_number}</Text>
              </View>
            ) : (
              <Text style={styles.historyDateWeekday}>{weekday}</Text>
            )}
          </View>

          {/* Right Header & Adherence Info */}
          <View style={styles.historyHeaderCol}>
            <View style={styles.historyHeaderTitleRow}>
              <Text style={styles.historyDayTitle} numberOfLines={1}>
                {isToday
                  ? `Today · ${weekday}, ${dayOfMonth} ${monthShort}`
                  : isYesterday
                  ? `Yesterday · ${weekday}, ${dayOfMonth} ${monthShort}`
                  : `${weekday}, ${dayOfMonth} ${monthShort}`}
              </Text>
              {renderBadge()}
            </View>

            {/* Calories Text and Target Bar */}
            <View style={styles.historyCalRow}>
              <Text style={styles.historyCalText}>
                {formatNumber(calConsumed)}
                <Text style={styles.historyCalTargetText}>
                  {isItemBulk
                    ? ` / min ${formatNumber(calTarget)} kcal`
                    : isItemCut
                    ? ` / max ${formatNumber(calTarget)} kcal`
                    : ` / ${formatNumber(calTarget)} kcal`}
                </Text>
              </Text>
              <Text
                style={[
                  styles.historyCalPct,
                  isItemBulk && pct >= 100 && { color: colors.success },
                  isItemCut && pct > 105 && { color: colors.warning },
                ]}
              >
                {pct}%
              </Text>
            </View>
            <ProgressBar
              percentage={pct}
              color={getBarColor()}
              height={5}
              delay={80}
              style={styles.historyProgressBar}
            />
          </View>
        </View>

        {/* Content details: macros */}
        {item.has_logged ? (
          <View style={styles.historyBody}>
            <View style={styles.historyMacrosRow}>
              <View
                style={[
                  styles.historyMacroPill,
                  isProteinMet && styles.historyMacroPillSuccess,
                ]}
              >
                <View style={[styles.historyMacroDot, { backgroundColor: isProteinMet ? colors.success : colors.cyan }]} />
                <Text style={styles.historyMacroText}>
                  P: {Math.round(item.total_protein)}
                  <Text style={styles.historyMacroTargetText}>/{Math.round(targetProtein)}g</Text>
                </Text>
                {isProteinMet ? (
                  <Text style={styles.historyMacroMetTag}>✓</Text>
                ) : (
                  <Text style={styles.historyMacroPctTag}>{proteinPct}%</Text>
                )}
              </View>
              <View style={styles.historyMacroPill}>
                <View style={[styles.historyMacroDot, { backgroundColor: colors.amber }]} />
                <Text style={styles.historyMacroText}>
                  C: {Math.round(item.total_carbs)}
                  <Text style={styles.historyMacroTargetText}>/{Math.round(targetCarbs)}g</Text>
                </Text>
              </View>
              <View style={styles.historyMacroPill}>
                <View style={[styles.historyMacroDot, { backgroundColor: colors.violet }]} />
                <Text style={styles.historyMacroText}>
                  F: {Math.round(item.total_fat)}
                  <Text style={styles.historyMacroTargetText}>/{Math.round(targetFat)}g</Text>
                </Text>
              </View>
              {item.water_consumed_ml > 0 && (
                <View style={styles.historyMacroPill}>
                  <View style={[styles.historyMacroDot, { backgroundColor: colors.blue }]} />
                  <Text style={styles.historyMacroText}>
                    {(item.water_consumed_ml / 1000).toFixed(1)}
                    <Text style={styles.historyMacroTargetText}>/{(targetWater / 1000).toFixed(1)}L</Text>
                  </Text>
                </View>
              )}
            </View>

            {item.meals.length > 0 && (
              <Text style={styles.historyMealsPreview} numberOfLines={1}>
                {item.meals.map((m) => m.name).join(' · ')}
              </Text>
            )}
          </View>
        ) : null}
      </PressableScale>

      {!item.has_logged ? (
        <View style={styles.historyEmptyRow}>
          <PressableScale
            haptic="selection"
            scaleTo={0.99}
            onPress={onSelect}
            style={styles.historyEmptyTextPressable}
            accessibilityLabel={`View nutrition details for ${item.date}`}
          >
            <Text style={styles.historyEmptyText}>No meals or water logged for this day</Text>
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={onLogMeal}
            style={styles.historyLogBtn}
            accessibilityLabel={`Log food for ${item.date}`}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.historyLogBtnText}>Log food</Text>
          </PressableScale>
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  tabBadge: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    marginLeft: 2,
  },
  tabBadgeActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderGlow,
    borderWidth: 1,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabBadgeTextActive: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  planBannerCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated,
  },
  planBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  planBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBannerInfo: {
    flex: 1,
  },
  planBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  planBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  planBannerDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 15,
  },
  macroSublabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primaryLight,
    marginTop: 1,
  },
  headerAddBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  waterHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  groupAddBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  emptyActions: {
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  addMoreBtn: {
    marginTop: spacing.sm,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  heroCard: {
    padding: spacing.xl,
    alignItems: 'stretch',
  },
  heroTop: {
    alignItems: 'center',
  },
  heroValue: {
    fontSize: 38,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSubtle,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  macroTile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  macroPct: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  macroTarget: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  waterCard: {
    padding: spacing.md,
    marginTop: spacing.md,
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  waterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waterIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  waterAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waterAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waterAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  waterAmountTarget: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  waterPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  waterPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  waterPresetHighlight: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  waterPresetPlus: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.blue,
  },
  waterPresetAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  waterPresetLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  waterPresetUndo: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  waterPresetUndoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
  },
  waterCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  waterCustomInput: {
    flex: 1,
    marginBottom: 0,
  },
  waterSaveBtn: {
    width: 38,
    height: 38,
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterCancelBtn: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerQuickAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  headerQuickAddText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.amber,
  },
  groupQuickAddBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  historyProgressBar: {
    marginTop: spacing.xs,
    width: '100%',
  },
  cupsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  cup: {
    flex: 1,
    height: 26,
    borderRadius: 6,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cupFilled: {
    backgroundColor: colors.blue,
    borderColor: 'rgba(96, 165, 250, 0.6)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  mealGroupCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  mealGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mealGroupIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealGroupTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  mealGroupKcal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  swipeDelete: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    marginVertical: 4,
  },
  swipeDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mealRow: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  mealRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealRowClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  macroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 5,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  servingsTag: {
    fontSize: 11,
    color: colors.textMuted,
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  historySectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  historySubhead: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  historyCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyCardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceElevated,
  },
  historyCardPressable: {
    alignSelf: 'stretch',
  },
  historyCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyDateTile: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginRight: spacing.md,
  },
  historyDateTileActive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  historyDateMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  historyDateDay: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  historyProgDayBadge: {
    marginTop: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  historyProgDayText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  historyDateWeekday: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 1,
  },
  historyHeaderCol: {
    flex: 1,
  },
  historyHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  historyDayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  historyCalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  historyCalText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  historyCalTargetText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  historyCalPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  historyProgressBarBg: {
    height: 5,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  historyProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  historyBody: {
    marginTop: spacing.xs,
  },
  historyMacrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  historyMacroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  historyMacroPillSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  historyMacroDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  historyMacroText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  historyMacroTargetText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
  },
  historyMacroMetTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
    marginLeft: 2,
  },
  historyMacroPctTag: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 2,
  },
  historyMealsPreview: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 5,
    fontStyle: 'italic',
  },
  historyEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  historyEmptyTextPressable: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  historyLogBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
}));
