import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Check, Minus, Plus, PencilLine, History } from 'lucide-react-native';
import { api, extractErrorMessage, type MealType } from '../../src/api/client';
import { Button, ChipGroup, Input, PressableScale, SheetScreen } from '../../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../../src/theme';
import { formatNumber } from '../../src/types';
import { formatDayLabel, isValidDateKey, parseNumberInput, toDateKey } from '../../src/lib/format';
import { invalidateTrackingData } from '../../src/lib/queries';
import { haptics } from '../../src/lib/haptics';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'DINNER', label: 'Dinner' },
  { value: 'SNACK', label: 'Snack' },
];

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
  const params = useLocalSearchParams<{ date?: string; type?: string }>();
  const date = isValidDateKey(params.date) ? params.date : toDateKey(new Date());
  const initialType = MEAL_TYPES.some((m) => m.value === params.type) ? (params.type as MealType) : defaultMealType();

  const [mealType, setMealType] = useState<MealType>(initialType);
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickedFood | null>(null);
  const [servings, setServings] = useState(1);
  const [custom, setCustom] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [customError, setCustomError] = useState<string | null>(null);

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

  const addMutation = useMutation({
    mutationFn: () => {
      if (mode === 'search' && picked) {
        // Database foods let the server compute macros; recent free-text entries are re-sent explicitly.
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
    addMutation.mutate();
  };

  const canSubmit = mode === 'custom' || !!picked;
  const isSearching = debouncedSearch.length >= 2;
  const listLoading = isSearching ? searchQuery.isFetching : recentQuery.isLoading;

  return (
    <SheetScreen
      title="Log food"
      subtitle={formatDayLabel(date)}
      footer={
        <Button
          title={
            mode === 'search' && picked
              ? `Add ${formatNumber(picked.calories * servings)} kcal`
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
          onPress={() => setMode('search')}
        />
        <SegmentButton
          active={mode === 'custom'}
          label="Manual entry"
          icon={<PencilLine size={15} color={mode === 'custom' ? colors.primaryLight : colors.textSecondary} />}
          onPress={() => setMode('custom')}
        />
      </View>

      {mode === 'search' ? (
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
            <View style={styles.servingsCard}>
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
                  <Text style={styles.servingValue}>{servings}</Text>
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
            </View>
          )}

          <View style={styles.listHeader}>
            {!isSearching && <History size={14} color={colors.textMuted} />}
            <Text style={styles.listHeaderText}>{isSearching ? 'Results' : 'Recently logged'}</Text>
            {listLoading && <ActivityIndicator size="small" color={colors.primaryLight} />}
          </View>

          {results.length === 0 && !listLoading ? (
            <Text style={styles.emptyText}>
              {isSearching
                ? 'No foods match. Try another name, or use manual entry.'
                : 'Search for a food above, or add one with manual entry.'}
            </Text>
          ) : (
            <View style={styles.list}>
              {results.map((f, i) => {
                const selected = picked?.key === f.key;
                return (
                  <PressableScale
                    key={f.key}
                    haptic="selection"
                    onPress={() => {
                      setPicked(f);
                      setServings(1);
                    }}
                    style={[styles.foodRow, i > 0 && styles.foodRowBorder, selected && styles.foodRowSelected]}
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${f.name}, ${formatNumber(f.calories)} calories per ${f.servingLabel}`}
                  >
                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <Text style={styles.foodMeta} numberOfLines={1}>
                        {f.servingLabel} · P {formatNumber(f.protein_g)} · C {formatNumber(f.carbs_g)} · F{' '}
                        {formatNumber(f.fat_g)}
                      </Text>
                    </View>
                    <Text style={styles.foodKcal}>{formatNumber(f.calories)}</Text>
                    {selected && <Check size={18} color={colors.primaryLight} strokeWidth={3} />}
                  </PressableScale>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <>
          <Input
            label="Food name"
            placeholder="e.g. Homemade dal"
            value={custom.name}
            onChangeText={(name) => setCustom((c) => ({ ...c, name }))}
          />
          <Input
            label="Calories (kcal)"
            placeholder="0"
            keyboardType="numeric"
            value={custom.calories}
            onChangeText={(calories) => setCustom((c) => ({ ...c, calories }))}
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
        </>
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
  },
}));
