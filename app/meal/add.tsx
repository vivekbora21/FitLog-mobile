import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, ActivityIndicator, type StyleProp, type TextStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Search, Check, Minus, Plus, PencilLine, History, Zap, RotateCcw, BookMarked } from 'lucide-react-native';
import { api, extractErrorMessage, type MealType } from '../../src/api/client';
import { Button, ChipGroup, Input, PressableScale, SheetScreen } from '../../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { formatNumber } from '../../src/types';
import { formatDayLabel, isValidDateKey, parseNumberInput, toDateKey } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';
import { MealTemplateSheet } from '../../src/components/nutrition/MealTemplateSheet';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'DINNER', label: 'Dinner' },
  { value: 'SNACK', label: 'Snack' },
];

const CALORIE_PRESETS = [100, 250, 500, 750, 1000];

function BumpText({ value, style }: { value: string | number; style?: StyleProp<TextStyle> }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.28, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 220 })
    );
  }, [value, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Text style={style}>{value}</Text>
    </Animated.View>
  );
}

/** Per-serving macros for whatever the user picked, from search or recents. */
interface PickedFood {
  key: string;
  foodId: string | null;
  name: string;
  servingLabel: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'BREAKFAST';
  if (h < 16) return 'LUNCH';
  if (h < 21) return 'DINNER';
  return 'SNACK';
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function AddMealScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string; type?: string; mode?: string }>();
  const date = isValidDateKey(params.date) ? params.date : toDateKey(new Date());
  const initialType = MEAL_TYPES.some((m) => m.value === params.type) ? (params.type as MealType) : defaultMealType();
  const initialMode = params.mode === 'quick' ? 'quick' : params.mode === 'custom' ? 'custom' : 'search';

  const [mealType, setMealType] = useState<MealType>(initialType);
  const [mode, setMode] = useState<'search' | 'quick' | 'custom'>(
    initialMode as 'search' | 'quick' | 'custom'
  );
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [templateLogging, setTemplateLogging] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickedFood | null>(null);
  const [servings, setServings] = useState(1);
  const [custom, setCustom] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [customError, setCustomError] = useState<string | null>(null);

  // Quick Add state
  const [quickCalories, setQuickCalories] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickProtein, setQuickProtein] = useState('');
  const [quickCarbs, setQuickCarbs] = useState('');
  const [quickFat, setQuickFat] = useState('');

  const debouncedSearch = useDebounced(search.trim(), 300);

  const recentQuery = useQuery({
    queryKey: ['recentFoods'],
    queryFn: () => api.getRecentFoods(),
  });

  const searchQuery = useQuery({
    queryKey: ['foods', debouncedSearch],
    queryFn: () => api.searchFoods(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const results: PickedFood[] = useMemo(() => {
    if (debouncedSearch.length >= 2) {
      return (searchQuery.data ?? []).map((f) => ({
        key: `food-${f.id}`,
        foodId: f.id,
        name: f.name,
        servingLabel: f.serving_label,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
      }));
    }
    return (recentQuery.data ?? []).map((f) => ({
      key: `recent-${f.id}`,
      foodId: f.food_id ?? null,
      name: f.name,
      servingLabel: f.serving_label,
      calories: f.calories,
      protein_g: f.protein_g,
      carbs_g: f.carbs_g,
      fat_g: f.fat_g,
    }));
  }, [debouncedSearch, searchQuery.data, recentQuery.data]);

  // Derived macro calorie estimation in Quick Add
  const calculatedMacroCals = useMemo(() => {
    const p = parseNumberInput(quickProtein) ?? 0;
    const c = parseNumberInput(quickCarbs) ?? 0;
    const f = parseNumberInput(quickFat) ?? 0;
    if (p <= 0 && c <= 0 && f <= 0) return null;
    return Math.round(p * 4 + c * 4 + f * 9);
  }, [quickProtein, quickCarbs, quickFat]);

  const addMutation = useMutation({
    mutationFn: () => {
      if (mode === 'search' && picked) {
        return picked.foodId
          ? api.addMeal({ date, meal_type: mealType, food: picked.foodId, servings })
          : api.addMeal({
              date,
              meal_type: mealType,
              name: picked.name,
              servings,
              calories: Math.round(picked.calories * servings),
              protein_g: +(picked.protein_g * servings).toFixed(1),
              carbs_g: +(picked.carbs_g * servings).toFixed(1),
              fat_g: +(picked.fat_g * servings).toFixed(1),
            });
      }

      if (mode === 'quick') {
        const cal = Math.round(parseNumberInput(quickCalories) ?? 0);
        const p = parseNumberInput(quickProtein) ?? 0;
        const c = parseNumberInput(quickCarbs) ?? 0;
        const f = parseNumberInput(quickFat) ?? 0;
        const slotLabel = MEAL_TYPES.find((m) => m.value === mealType)?.label ?? 'Meal';
        const label = quickName.trim() || `Quick Add (${slotLabel})`;
        return api.addMeal({
          date,
          meal_type: mealType,
          name: label,
          servings: 1,
          calories: cal,
          protein_g: p,
          carbs_g: c,
          fat_g: f,
        });
      }

      return api.addMeal({
        date,
        meal_type: mealType,
        name: custom.name.trim(),
        servings: 1,
        calories: Math.round(parseNumberInput(custom.calories) ?? 0),
        protein_g: parseNumberInput(custom.protein) ?? 0,
        carbs_g: parseNumberInput(custom.carbs) ?? 0,
        fat_g: parseNumberInput(custom.fat) ?? 0,
      });
    },
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't log food", extractErrorMessage(err));
    },
  });

  const submit = () => {
    if (mode === 'custom') {
      if (!custom.name.trim()) return setCustomError('Enter a name for this food.');
      if (parseNumberInput(custom.calories) == null) return setCustomError('Enter the calories.');
      setCustomError(null);
    }
    if (mode === 'quick') {
      const cal = parseNumberInput(quickCalories);
      if (cal == null || cal <= 0) return setCustomError('Please enter calories.');
      setCustomError(null);
    }
    addMutation.mutate();
  };

  const canSubmit =
    (mode === 'search' && !!picked) ||
    (mode === 'quick' && Boolean(parseNumberInput(quickCalories) && parseNumberInput(quickCalories)! > 0)) ||
    (mode === 'custom' && Boolean(custom.name.trim() && parseNumberInput(custom.calories) != null));

  const isSearching = debouncedSearch.length >= 2;
  const listLoading = isSearching ? searchQuery.isFetching : recentQuery.isLoading;

  const handlePresetAdd = (amount: number) => {
    haptics.selection();
    const curr = parseInt(quickCalories, 10) || 0;
    setQuickCalories(String(curr + amount));
  };

  const handlePresetClear = () => {
    haptics.selection();
    setQuickCalories('');
  };

  const handleTemplateApply = async (
    items: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; servings?: number }[],
  ) => {
    setTemplateLogging(true);
    try {
      for (const item of items) {
        await api.addMeal({
          date,
          meal_type: mealType,
          name: item.name,
          servings: item.servings ?? 1,
          calories: Math.round(item.calories),
          protein_g: +item.protein_g.toFixed(1),
          carbs_g: +item.carbs_g.toFixed(1),
          fat_g: +item.fat_g.toFixed(1),
        });
      }
      await invalidateTrackingData(queryClient);
      haptics.success();
      router.back();
    } catch (err) {
      Alert.alert('Template error', extractErrorMessage(err));
    } finally {
      setTemplateLogging(false);
    }
  };

  return (
    <SheetScreen
      title="Log food"
      subtitle={formatDayLabel(date)}
      footer={
        <Button
          title={
            mode === 'search' && picked
              ? `Add ${formatNumber(picked.calories * servings)} kcal`
              : mode === 'quick'
                ? quickCalories && parseNumberInput(quickCalories)! > 0
                  ? `Add ${quickCalories} kcal`
                  : 'Enter calories'
                : mode === 'search'
                  ? 'Pick a food'
                  : 'Add entry'
          }
          size="lg"
          disabled={!canSubmit}
          loading={addMutation.isPending}
          onPress={submit}
        />
      }
    >
      <ChipGroup label="Meal" options={MEAL_TYPES} value={mealType} onChange={setMealType} />

      <View style={styles.segment}>
        <SegmentButton
          active={mode === 'search'}
          label="Search"
          icon={<Search size={15} color={mode === 'search' ? colors.primaryLight : colors.textSecondary} />}
          onPress={() => {
            setCustomError(null);
            setMode('search');
          }}
        />
        <SegmentButton
          active={mode === 'quick'}
          label="Quick Add"
          icon={<Zap size={15} color={mode === 'quick' ? colors.amber : colors.textSecondary} />}
          onPress={() => {
            setCustomError(null);
            setMode('quick');
          }}
        />
        <SegmentButton
          active={mode === 'custom'}
          label="Custom"
          icon={<PencilLine size={15} color={mode === 'custom' ? colors.primaryLight : colors.textSecondary} />}
          onPress={() => {
            setCustomError(null);
            setMode('custom');
          }}
        />
        <SegmentButton
          active={false}
          label="Templates"
          icon={<BookMarked size={15} color={colors.textSecondary} />}
          onPress={() => setTemplateSheetOpen(true)}
        />
      </View>

      {/* Meal Template Sheet */}
      <MealTemplateSheet
        visible={templateSheetOpen}
        mealType={mealType}
        yesterdayMeals={recentQuery.data as any}
        onApply={handleTemplateApply}
        onClose={() => setTemplateSheetOpen(false)}
      />

      {mode === 'search' && (
        <>
          <Input
            placeholder="Search foods (e.g. oats, chicken)"
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              setPicked(null);
            }}
            leftIcon={<Search size={18} color={colors.textMuted} />}
            autoCorrect={false}
            returnKeyType="search"
            containerStyle={styles.searchInput}
          />

          {picked && (
            <Animated.View entering={FadeInDown.duration(220)} style={styles.servingsCard}>
              <Text style={styles.servingsTitle} numberOfLines={1}>
                {picked.name}
              </Text>
              <Text style={styles.servingsSub}>Per serving: {picked.servingLabel}</Text>
              <View style={styles.servingsRow}>
                <PressableScale
                  haptic="selection"
                  disabled={servings <= 0.5}
                  onPress={() => setServings((s) => Math.max(0.5, +(s - 0.5).toFixed(2)))}
                  style={[styles.servingBtn, servings <= 0.5 && styles.disabled]}
                  accessibilityLabel="Fewer servings"
                >
                  <Minus size={18} color={colors.textPrimary} />
                </PressableScale>
                <View style={styles.servingValueBox}>
                  <BumpText value={servings} style={styles.servingValue} />
                  <Text style={styles.servingUnit}>{servings === 1 ? 'serving' : 'servings'}</Text>
                </View>
                <PressableScale
                  haptic="selection"
                  onPress={() => setServings((s) => +(s + 0.5).toFixed(2))}
                  style={styles.servingBtn}
                  accessibilityLabel="More servings"
                >
                  <Plus size={18} color={colors.textPrimary} />
                </PressableScale>
              </View>
              <Text style={styles.macroLine}>
                {formatNumber(picked.calories * servings)} kcal · P {formatNumber(picked.protein_g * servings)}g · C{' '}
                {formatNumber(picked.carbs_g * servings)}g · F {formatNumber(picked.fat_g * servings)}g
              </Text>
            </Animated.View>
          )}

          <View style={styles.listHeader}>
            {!isSearching && <History size={14} color={colors.textMuted} />}
            <Text style={styles.listHeaderText}>{isSearching ? 'Results' : 'Recently logged'}</Text>
            {listLoading && <ActivityIndicator size="small" color={colors.primaryLight} />}
          </View>

          {results.length === 0 && !listLoading ? (
            <Text style={styles.emptyText}>
              {isSearching
                ? 'No foods match. Try another name, or use quick add.'
                : 'Search for a food above, or tap Quick Add.'}
            </Text>
          ) : (
            <Animated.View layout={LinearTransition.springify()} style={styles.list}>
              {results.map((f, i) => {
                const selected = picked?.key === f.key;
                return (
                  <Animated.View
                    key={f.key}
                    entering={FadeInDown.delay(Math.min(i * 35, 180)).duration(200)}
                    layout={LinearTransition.springify()}
                  >
                    <PressableScale
                      haptic="selection"
                      onPress={() => {
                        setPicked(f);
                        setServings(1);
                      }}
                      style={[styles.foodRow, i > 0 && styles.foodRowBorder, selected && styles.foodRowSelected]}
                      accessibilityLabel={`Select ${f.name}`}
                    >
                      <View style={styles.foodInfo}>
                        <Text style={styles.foodName}>{f.name}</Text>
                        <Text style={styles.foodMeta}>
                          {f.servingLabel} · P {f.protein_g}g · C {f.carbs_g}g · F {f.fat_g}g
                        </Text>
                      </View>
                      <Text style={styles.foodKcal}>{f.calories} kcal</Text>
                      {selected && <Check size={18} color={colors.primaryLight} />}
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}
        </>
      )}

      {mode === 'quick' && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.quickContainer}>
          <View style={styles.quickCalorieCard}>
            <Text style={styles.quickLabel}>Estimated Calories</Text>
            <View style={styles.quickInputRow}>
              <Input
                placeholder="0"
                keyboardType="number-pad"
                value={quickCalories}
                onChangeText={(text) => {
                  setQuickCalories(text.replace(/[^0-9]/g, ''));
                  setCustomError(null);
                }}
                containerStyle={styles.quickCalInput}
                autoFocus
                accessibilityLabel="Quick calorie amount"
              />
              <Text style={styles.quickCalUnit}>kcal</Text>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetChipsRow}>
              {CALORIE_PRESETS.map((amt) => (
                <PressableScale
                  key={amt}
                  haptic="selection"
                  onPress={() => handlePresetAdd(amt)}
                  style={styles.presetChip}
                  accessibilityLabel={`Add ${amt} calories`}
                >
                  <Text style={styles.presetChipText}>+{amt}</Text>
                </PressableScale>
              ))}
              {quickCalories !== '' && (
                <PressableScale
                  haptic="selection"
                  onPress={handlePresetClear}
                  style={[styles.presetChip, styles.presetClearChip]}
                  accessibilityLabel="Clear calories"
                >
                  <RotateCcw size={12} color={colors.textSecondary} />
                  <Text style={styles.presetClearText}>Reset</Text>
                </PressableScale>
              )}
            </View>
          </View>

          <Input
            label="Meal or Food Description (Optional)"
            placeholder="e.g. Restaurant lunch, Chipotle bowl, Snack"
            value={quickName}
            onChangeText={setQuickName}
            containerStyle={styles.quickField}
          />

          <View style={styles.quickMacroHeader}>
            <Text style={styles.quickMacroTitle}>Optional Macros</Text>
            {calculatedMacroCals !== null && (
              <PressableScale
                haptic="selection"
                onPress={() => setQuickCalories(String(calculatedMacroCals))}
                style={styles.macroCalcBadge}
                accessibilityLabel={`Macros equal ${calculatedMacroCals} kcal. Tap to apply.`}
              >
                <Text style={styles.macroCalcText}>Macros: {calculatedMacroCals} kcal (Tap to apply)</Text>
              </PressableScale>
            )}
          </View>

          <View style={styles.macroInputs}>
            <Input
              label="Protein (g)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={quickProtein}
              onChangeText={setQuickProtein}
              containerStyle={styles.macroInput}
            />
            <Input
              label="Carbs (g)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={quickCarbs}
              onChangeText={setQuickCarbs}
              containerStyle={styles.macroInput}
            />
            <Input
              label="Fat (g)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={quickFat}
              onChangeText={setQuickFat}
              containerStyle={styles.macroInput}
            />
          </View>

          {customError && <Text style={styles.errorText}>{customError}</Text>}
        </Animated.View>
      )}

      {mode === 'custom' && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <Input
            label="Food name"
            placeholder="e.g. Grandma's Lasagna"
            value={custom.name}
            onChangeText={(name) => setCustom((c) => ({ ...c, name }))}
            containerStyle={styles.searchInput}
            autoFocus
          />
          <Input
            label="Calories"
            placeholder="e.g. 450"
            keyboardType="number-pad"
            value={custom.calories}
            onChangeText={(calories) => setCustom((c) => ({ ...c, calories }))}
            containerStyle={styles.searchInput}
          />
          <View style={styles.macroInputs}>
            <Input
              label="Protein (g)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={custom.protein}
              onChangeText={(protein) => setCustom((c) => ({ ...c, protein }))}
              containerStyle={styles.macroInput}
            />
            <Input
              label="Carbs (g)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={custom.carbs}
              onChangeText={(carbs) => setCustom((c) => ({ ...c, carbs }))}
              containerStyle={styles.macroInput}
            />
            <Input
              label="Fat (g)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={custom.fat}
              onChangeText={(fat) => setCustom((c) => ({ ...c, fat }))}
              containerStyle={styles.macroInput}
            />
          </View>
          {customError && <Text style={styles.errorText}>{customError}</Text>}
        </Animated.View>
      )}
    </SheetScreen>
  );
}

function SegmentButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <PressableScale
      haptic="selection"
      onPress={onPress}
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.primarySurface,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.primaryLight,
  },
  searchInput: {
    marginBottom: spacing.md,
  },
  quickContainer: {
    gap: spacing.sm,
  },
  quickCalorieCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  quickInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickCalInput: {
    flex: 1,
    marginBottom: 0,
  },
  quickCalUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  presetClearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  presetClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickField: {
    marginBottom: spacing.xs,
  },
  quickMacroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  quickMacroTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroCalcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
  },
  macroCalcText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  servingsCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  servingsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  servingsSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  servingBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  servingValueBox: {
    alignItems: 'center',
    minWidth: 72,
  },
  servingValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  servingUnit: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  macroLine: {
    fontSize: 13,
    color: colors.primaryLight,
    fontWeight: '700',
    textAlign: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  foodRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  foodRowSelected: {
    backgroundColor: colors.primarySurface,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  foodMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  foodKcal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  macroInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroInput: {
    flex: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
}));
