import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage, type MealType } from '../../src/api/client';
import { Button, ChipGroup, Input, SheetScreen, Stepper, useToast } from '../../src/components/ui';
import { makeStyles, spacing, useTheme } from '../../src/theme';
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

export default function EditMealScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const date = isValidDateKey(params.date) ? params.date : toDateKey(new Date());
  const queryKey = ['nutritionDay', date];

  // The meal isn't fetched on its own — it's the day it belongs to that's cached.
  const dayQuery = useQuery({ queryKey, queryFn: () => api.getNutrition(date) });
  const meal = dayQuery.data?.day?.meals.find((m) => m.id === params.id);

  const [mealType, setMealType] = useState<MealType | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [servings, setServings] = useState<number | null>(null);
  const [calories, setCalories] = useState<string | null>(null);
  const [protein, setProtein] = useState<string | null>(null);
  const [carbs, setCarbs] = useState<string | null>(null);
  const [fat, setFat] = useState<string | null>(null);

  const activeType = mealType ?? meal?.meal_type ?? 'SNACK';
  const activeName = name ?? meal?.name ?? '';
  const activeServings = servings ?? meal?.servings ?? null;
  const isFromFood = !!meal?.food;

  const mutation = useMutation({
    mutationFn: () =>
      api.updateMeal(params.id, {
        meal_type: activeType,
        ...(isFromFood
          ? { servings: activeServings ?? 1 }
          : {
              name: activeName.trim(),
              calories: Math.round(parseNumberInput(calories ?? String(meal!.calories)) ?? 0),
              protein_g: parseNumberInput(protein ?? String(meal!.protein_g)) ?? 0,
              carbs_g: parseNumberInput(carbs ?? String(meal!.carbs_g)) ?? 0,
              fat_g: parseNumberInput(fat ?? String(meal!.fat_g)) ?? 0,
            }),
      }),
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      toast({ message: 'Meal updated' });
      router.back();
    },
    onError: () => haptics.error(),
    onSettled: () => invalidateTrackingData(queryClient),
  });

  if (dayQuery.isLoading) {
    return (
      <SheetScreen title="Edit meal">
        <ActivityIndicator color={colors.primaryLight} />
      </SheetScreen>
    );
  }

  if (!meal) {
    return (
      <SheetScreen title="Edit meal">
        <Text style={styles.error}>This entry can no longer be found — it may have already been deleted.</Text>
      </SheetScreen>
    );
  }

  const previewCalories = isFromFood
    ? Math.round((meal.calories / (meal.servings || 1)) * (activeServings ?? 1))
    : Math.round(parseNumberInput(calories ?? String(meal.calories)) ?? 0);

  return (
    <SheetScreen
      title="Edit meal"
      subtitle={formatDayLabel(date)}
      footer={
        <Button
          title={`Save · ${formatNumber(previewCalories)} kcal`}
          size="lg"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      }
    >
      <ChipGroup label="Meal" options={MEAL_TYPES} value={activeType} onChange={setMealType} />

      {isFromFood ? (
        <>
          <Text style={styles.foodName}>{meal.name}</Text>
          <View style={styles.servingsRow}>
            <Text style={styles.servingsLabel}>Servings</Text>
            <Text style={styles.servingsValue}>{activeServings ?? 1}</Text>
            <Stepper
              label="a serving"
              canDecrement={(activeServings ?? 1) > 0.5}
              onDecrement={() => setServings(Math.max(0.5, (activeServings ?? 1) - 0.5))}
              onIncrement={() => setServings((activeServings ?? 1) + 0.5)}
            />
          </View>
        </>
      ) : (
        <>
          <Input label="Name" value={activeName} onChangeText={setName} />
          <Input
            label="Calories"
            value={calories ?? String(meal.calories)}
            onChangeText={setCalories}
            keyboardType="number-pad"
          />
          <Input label="Protein (g)" value={protein ?? String(meal.protein_g)} onChangeText={setProtein} keyboardType="decimal-pad" />
          <Input label="Carbs (g)" value={carbs ?? String(meal.carbs_g)} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <Input label="Fat (g)" value={fat ?? String(meal.fat_g)} onChangeText={setFat} keyboardType="decimal-pad" />
        </>
      )}

      {mutation.isError ? <Text style={styles.error}>{extractErrorMessage(mutation.error)}</Text> : null}
    </SheetScreen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  foodName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  servingsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  servingsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    marginTop: spacing.sm,
  },
}));
