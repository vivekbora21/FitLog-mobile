import React, { useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Sparkles,
  Info,
} from 'lucide-react-native';
import { api, extractErrorMessage } from '../src/api/client';
import {
  Badge,
  Button,
  Card,
  Input,
  SheetScreen,
  useToast,
} from '../src/components/ui';
import { radius, spacing, makeStyles, useTheme } from '../src/theme';
import { formatNumber } from '../src/types';
import { parseNumberInput } from '../src/lib/format';
import { invalidateTrackingData } from '../src/lib/queries';
import { haptics } from '../src/lib/haptics';

export default function NutritionTargetsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const targetsQuery = useQuery({
    queryKey: ['macroTargets'],
    queryFn: () => api.getMacroTargets(),
  });

  const recommendedQuery = useQuery({
    queryKey: ['recommendedTargets'],
    queryFn: () => api.getRecommendedTargets(),
  });

  const targets = targetsQuery.data;
  const recommended = recommendedQuery.data;

  const [calories, setCalories] = useState<string | null>(null);
  const [protein, setProtein] = useState<string | null>(null);
  const [carbs, setCarbs] = useState<string | null>(null);
  const [fat, setFat] = useState<string | null>(null);
  const [water, setWater] = useState<string | null>(null);

  const activeCalories = calories ?? (targets ? String(targets.daily_calories) : '');
  const activeProtein = protein ?? (targets ? String(targets.protein_g) : '');
  const activeCarbs = carbs ?? (targets ? String(targets.carbs_g) : '');
  const activeFat = fat ?? (targets ? String(targets.fat_g) : '');
  const activeWater = water ?? (targets ? String(targets.water_ml) : '');

  const hasChanges =
    calories !== null || protein !== null || carbs !== null || fat !== null || water !== null;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, number> = {};
      if (calories !== null) payload.daily_calories = Math.round(parseNumberInput(calories) ?? 0);
      if (protein !== null) payload.protein_g = Math.round(parseNumberInput(protein) ?? 0);
      if (carbs !== null) payload.carbs_g = Math.round(parseNumberInput(carbs) ?? 0);
      if (fat !== null) payload.fat_g = Math.round(parseNumberInput(fat) ?? 0);
      if (water !== null) payload.water_ml = Math.round(parseNumberInput(water) ?? 0);
      return api.updateMacroTargets(payload);
    },
    onSuccess: async () => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      queryClient.invalidateQueries({ queryKey: ['macroTargets'] });
      toast({ message: 'Targets updated' });
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't update targets", extractErrorMessage(err));
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => api.applyRecommendedTargets(),
    onSuccess: async (result) => {
      haptics.success();
      await invalidateTrackingData(queryClient);
      queryClient.invalidateQueries({ queryKey: ['macroTargets'] });
      queryClient.invalidateQueries({ queryKey: ['recommendedTargets'] });
      toast({ message: `Applied ${formatNumber(result.daily_calories)} kcal target` });
      router.back();
    },
    onError: (err) => {
      haptics.error();
      Alert.alert("Couldn't apply recommendation", extractErrorMessage(err));
    },
  });

  if (targetsQuery.isLoading) {
    return (
      <SheetScreen title="Nutrition Targets">
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primaryLight} />
        </View>
      </SheetScreen>
    );
  }

  if (targetsQuery.isError) {
    return (
      <SheetScreen title="Nutrition Targets">
        <Text style={styles.errorText}>
          {extractErrorMessage(targetsQuery.error)}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => targetsQuery.refetch()} />
      </SheetScreen>
    );
  }

  const showRecommended =
    recommended?.available === true &&
    targets &&
    recommended.daily_calories !== targets.daily_calories;

  return (
    <SheetScreen
      title="Nutrition Targets"
      subtitle="Daily calorie & macro goals"
      footer={
        <Button
          title="Save targets"
          size="lg"
          disabled={!hasChanges}
          loading={saveMutation.isPending}
          onPress={() => saveMutation.mutate()}
        />
      }
    >
      {/* Recommended targets card */}
      {recommended?.available === true && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={styles.recommendedCard}>
            <View style={styles.recommendedHeader}>
              <View style={styles.recommendedIconBg}>
                <Sparkles size={16} color={colors.primaryLight} />
              </View>
              <View style={styles.recommendedHeaderText}>
                <Text style={styles.recommendedTitle}>Computed from your profile</Text>
                <Text style={styles.recommendedSubtitle}>
                  BMR {formatNumber(recommended.bmr)} × {recommended.activity_factor} = {formatNumber(recommended.tdee)} TDEE
                </Text>
              </View>
            </View>

            <View style={styles.recommendedSteps}>
              <StepRow label="BMR (Mifflin-St Jeor)" value={`${formatNumber(recommended.bmr)} kcal`} />
              <StepRow
                label={`TDEE (${recommended.inputs.activity_level.toLowerCase()})`}
                value={`${formatNumber(recommended.tdee)} kcal`}
              />
              <StepRow
                label="Goal adjustment"
                value={
                  recommended.calorie_adjustment > 0
                    ? `+${formatNumber(recommended.calorie_adjustment)} kcal`
                    : `${formatNumber(recommended.calorie_adjustment)} kcal`
                }
                sublabel={recommended.goal_source}
              />
              <StepRow
                label="Recommended"
                value={`${formatNumber(recommended.daily_calories)} kcal`}
                highlight
                sublabel={`P ${formatNumber(recommended.protein_g)}g · C ${formatNumber(recommended.carbs_g)}g · F ${formatNumber(recommended.fat_g)}g`}
              />
            </View>

            {showRecommended && (
              <Button
                title={`Use ${formatNumber(recommended.daily_calories)} kcal`}
                size="sm"
                variant="primary"
                loading={applyMutation.isPending}
                onPress={() => {
                  Alert.alert(
                    'Apply recommended targets?',
                    `This will set your daily target to ${formatNumber(recommended.daily_calories)} kcal with ${formatNumber(recommended.protein_g)}g protein, ${formatNumber(recommended.carbs_g)}g carbs, and ${formatNumber(recommended.fat_g)}g fat.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Apply', onPress: () => applyMutation.mutate() },
                    ],
                  );
                }}
                style={styles.applyBtn}
              />
            )}

            {!showRecommended && recommended.available && targets && (
              <View style={styles.matchRow}>
                <Badge label="Targets match recommendation" tone="emerald" />
              </View>
            )}
          </Card>
        </Animated.View>
      )}

      {recommended?.available === false && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={styles.missingCard}>
            <View style={styles.missingRow}>
              <Info size={16} color={colors.amber} />
              <Text style={styles.missingText}>
                Add your {recommended.missing.join(', ')} in Profile to compute targets from BMR.
              </Text>
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Manual target inputs */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)}>
        <Text style={styles.sectionTitle}>Calorie & Macro Targets</Text>
        <Text style={styles.sectionHint}>
          These are the daily goals shown on your Nutrition tab.
        </Text>

        <Input
          label="Daily Calories (kcal)"
          value={activeCalories}
          onChangeText={(t) => setCalories(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="e.g. 2200"
          containerStyle={styles.input}
        />

        <View style={styles.macroRow}>
          <Input
            label="Protein (g)"
            value={activeProtein}
            onChangeText={(t) => setProtein(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="160"
            containerStyle={styles.macroInput}
          />
          <Input
            label="Carbs (g)"
            value={activeCarbs}
            onChangeText={(t) => setCarbs(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="240"
            containerStyle={styles.macroInput}
          />
          <Input
            label="Fat (g)"
            value={activeFat}
            onChangeText={(t) => setFat(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="65"
            containerStyle={styles.macroInput}
          />
        </View>

        <Input
          label="Daily Water Target (ml)"
          value={activeWater}
          onChangeText={(t) => setWater(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="2500"
          containerStyle={styles.input}
        />
      </Animated.View>

      {/* Preview of calorie breakdown */}
      {(parseNumberInput(activeCalories) ?? 0) > 0 && (
        <Animated.View entering={FadeInDown.delay(160).duration(300)}>
          <Card style={styles.previewCard}>
            <Text style={styles.previewTitle}>Macro Calorie Breakdown</Text>
            <MacroBreakdownRow
              label="Protein"
              grams={parseNumberInput(activeProtein) ?? 0}
              multiplier={4}
              total={parseNumberInput(activeCalories) ?? 0}
              color={colors.cyan}
            />
            <MacroBreakdownRow
              label="Carbs"
              grams={parseNumberInput(activeCarbs) ?? 0}
              multiplier={4}
              total={parseNumberInput(activeCalories) ?? 0}
              color={colors.amber}
            />
            <MacroBreakdownRow
              label="Fat"
              grams={parseNumberInput(activeFat) ?? 0}
              multiplier={9}
              total={parseNumberInput(activeCalories) ?? 0}
              color={colors.violet}
            />
          </Card>
        </Animated.View>
      )}
    </SheetScreen>
  );
}

function StepRow({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.stepRow, highlight && styles.stepRowHighlight]}>
      <View style={styles.stepRowLeft}>
        <Text style={[styles.stepLabel, highlight && styles.stepLabelHighlight]}>{label}</Text>
        {sublabel && <Text style={styles.stepSublabel}>{sublabel}</Text>}
      </View>
      <Text style={[styles.stepValue, highlight && styles.stepValueHighlight]}>{value}</Text>
    </View>
  );
}

function MacroBreakdownRow({
  label,
  grams,
  multiplier,
  total,
  color,
}: {
  label: string;
  grams: number;
  multiplier: number;
  total: number;
  color: string;
}) {
  const styles = useStyles();
  const cals = Math.round(grams * multiplier);
  const pct = total > 0 ? Math.round((cals / total) * 100) : 0;
  return (
    <View style={styles.breakdownRow}>
      <View style={[styles.breakdownDot, { backgroundColor: color }]} />
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownCals}>
        {formatNumber(cals)} kcal
      </Text>
      <Text style={styles.breakdownPct}>{pct}%</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  recommendedCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: colors.borderGlow,
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recommendedIconBg: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.primaryLight}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedHeaderText: {
    flex: 1,
  },
  recommendedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  recommendedSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  recommendedSteps: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
  },
  stepRowHighlight: {
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  stepRowLeft: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepLabelHighlight: {
    color: colors.primaryLight,
    fontWeight: '800',
  },
  stepSublabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 1,
  },
  stepValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  stepValueHighlight: {
    color: colors.primaryLight,
  },
  applyBtn: {
    marginTop: spacing.xs,
  },
  matchRow: {
    marginTop: spacing.xs,
    alignItems: 'flex-start',
  },
  missingCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: `${colors.amber}40`,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 17,
  },
  input: {
    marginBottom: spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroInput: {
    flex: 1,
    marginBottom: spacing.md,
  },
  previewCard: {
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  breakdownCals: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  breakdownPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    width: 36,
    textAlign: 'right',
  },
}));
