import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Utensils, Coffee, Sun, Moon, Cookie, GlassWater, Plus, Trash2, Copy } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../src/api/client';
import {
  Button,
  Card,
  DateNavigator,
  EmptyState,
  ErrorState,
  PressableScale,
  ProgressRing,
  ScreenHeader,
  ScreenSkeleton,
  Stepper,
  useToast,
} from '../../src/components/ui';
import { useTabBarClearance } from '../../src/components/navigation/TabBar';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { formatNumber, calculateMacroPercentage } from '../../src/types';
import type { MealEntry, NutritionDayResponse } from '../../src/types';
import { formatDayLabel, isValidDateKey, toDateKey } from '../../src/lib/format';
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

export default function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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
    await refetch();
  };

  const openAddMeal = (mealType?: MealEntry['meal_type']) =>
    router.push({ pathname: '/meal/add', params: { date, ...(mealType ? { type: mealType } : {}) } });

  const openMeal = (meal: MealEntry) => router.push({ pathname: '/meal/[id]', params: { id: meal.id, date } });

  const day = nutritionData?.day;
  const targets = nutritionData?.targets;
  const previousDayMeals = nutritionData?.yesterday_meals ?? [];

  const mealGroups = useMemo(() => {
    const meals = day?.meals || [];
    return MEAL_ORDER.map((type) => {
      const items = meals.filter((m) => m.meal_type === type);
      return { type, items, calories: items.reduce((sum, m) => sum + (m.calories || 0), 0) };
    }).filter((g) => g.items.length > 0);
  }, [day?.meals]);

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
  const caloriesTarget = targets?.daily_calories || 2200;
  const calPct = calculateMacroPercentage(caloriesConsumed, caloriesTarget);
  const caloriesLeft = caloriesTarget - caloriesConsumed;

  const macros = [
    { label: 'Protein', consumed: day?.total_protein || 0, target: targets?.protein_g || 160, color: colors.cyan },
    { label: 'Carbs', consumed: day?.total_carbs || 0, target: targets?.carbs_g || 240, color: colors.amber },
    { label: 'Fat', consumed: day?.total_fat || 0, target: targets?.fat_g || 65, color: colors.violet },
  ];

  const waterMl = day?.water_consumed_ml || 0;
  const waterTargetMl = targets?.water_ml || 2500;
  const waterTargetCups = Math.max(1, Math.round(waterTargetMl / CUP_ML));
  const waterCups = Math.round(waterMl / CUP_ML);
  const dayLabel = formatDayLabel(date);
  const isToday = dayLabel === 'Today';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
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

        <DateNavigator date={date} onChange={setDate} />

        {/* Calorie hero */}
        <Animated.View entering={enter(0)}>
          <Card elevated style={styles.heroCard}>
            <View style={styles.heroTop}>
              <ProgressRing
                percentage={calPct}
                size={176}
                strokeWidth={14}
                color={colors.primaryLight}
                gradientTo={colors.cyan}
                delay={200}
              >
                <Text style={styles.heroValue}>{formatNumber(Math.abs(caloriesLeft))}</Text>
                <Text style={[styles.heroLabel, caloriesLeft < 0 && { color: colors.warning }]}>
                  {caloriesLeft >= 0 ? 'kcal remaining' : 'kcal over'}
                </Text>
              </ProgressRing>
            </View>

            <View style={styles.heroStatsRow}>
              <HeroStat label="Eaten" value={formatNumber(caloriesConsumed)} />
              <View style={styles.heroDivider} />
              <HeroStat label="Goal" value={formatNumber(caloriesTarget)} />
              <View style={styles.heroDivider} />
              <HeroStat label="Progress" value={`${calPct}%`} accent />
            </View>
          </Card>
        </Animated.View>

        {/* Macro rings */}
        <Animated.View entering={enter(1)} style={styles.macroRow}>
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
              <Text style={styles.waterAmount}>
                {(waterMl / 1000).toFixed(2)}
                <Text style={styles.waterAmountTarget}> / {(waterTargetMl / 1000).toFixed(1)} L</Text>
              </Text>
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
            <View
              style={styles.cupsRow}
              accessible
              accessibilityLabel={`${waterCups} of ${waterTargetCups} cups of water`}
            >
              {Array.from({ length: Math.min(waterTargetCups, 12) }).map((_, i) => (
                <View key={i} style={[styles.cup, i < waterCups && styles.cupFilled]} />
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Meals */}
        <Animated.View entering={enter(3)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{isToday ? "Today's meals" : `Meals · ${dayLabel}`}</Text>
            {mealGroups.length > 0 && (
              <Text style={styles.sectionMeta}>{day?.meals?.length ?? 0} entries</Text>
            )}
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
                      onPress={() => openAddMeal(group.type)}
                      style={styles.groupAddBtn}
                      accessibilityLabel={`Add to ${meta.label}`}
                    >
                      <Plus size={16} color={colors.primaryLight} />
                    </PressableScale>
                  </View>

                  {group.items.map((meal, mi) => (
                    <MealRow
                      key={meal.id}
                      meal={meal}
                      bordered={mi > 0}
                      disabled={isPlaceholderData}
                      onOpen={() => openMeal(meal)}
                      onDelete={() => deleteMutation.mutate(meal)}
                    />
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
      <PressableScale
        haptic="selection"
        scaleTo={0.99}
        onPress={onOpen}
        disabled={disabled}
        style={[styles.mealRow, bordered && styles.mealRowBorder]}
        accessibilityLabel={`${meal.name}, ${formatNumber(meal.calories)} calories. Tap to edit`}
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete()}
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
        <PressableScale
          haptic="light"
          onPress={onDelete}
          disabled={disabled}
          style={styles.deleteBtn}
          accessibilityLabel={`Delete ${meal.name}`}
        >
          <Trash2 size={16} color={colors.textMuted} />
        </PressableScale>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroStatValue, accent && { color: colors.primaryLight }]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
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

const useStyles = makeStyles(({ colors }) => ({
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
  cupsRow: {
    flexDirection: 'row',
    gap: 6,
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
}));
