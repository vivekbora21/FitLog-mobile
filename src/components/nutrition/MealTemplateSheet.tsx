/**
 * MealTemplateSheet
 *
 * A slide-up bottom sheet offering meal templates grouped by meal type.
 * Templates include:
 *   1. Yesterday's meals (from NutritionDayResponse.yesterday_meals)
 *   2. Plan's meal_payload if available (from ProgramDay)
 *   3. Curated macro-matched quick templates
 *
 * When the user picks a template, onApply is called with the list of MealEntry
 * payloads to bulk-add. The caller logs them via the MealEntry API.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { ChevronDown, Copy, Utensils, Zap, BookMarked } from 'lucide-react-native';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { PressableScale } from '../ui';
import type { MealEntry } from '../../types';

export interface MealTemplate {
  id: string;
  name: string;
  description: string;
  source: 'yesterday' | 'plan' | 'preset';
  meal_type: MealEntry['meal_type'];
  items: {
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    servings?: number;
  }[];
}

interface Props {
  visible: boolean;
  mealType: MealEntry['meal_type'];
  yesterdayMeals?: MealEntry[];
  /** Optional JSON meal_payload from ProgramDay */
  planMealPayload?: any;
  onApply: (items: MealTemplate['items'], source: MealTemplate['source']) => void;
  onClose: () => void;
}

// ───────────────── Preset Templates ─────────────────
const PRESET_TEMPLATES: Omit<MealTemplate, 'id'>[] = [
  {
    name: 'High Protein Breakfast',
    description: '~550 kcal · 45g protein',
    source: 'preset',
    meal_type: 'BREAKFAST',
    items: [
      { name: 'Oats (dry)', calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3 },
      { name: 'Whey Protein Shake', calories: 120, protein_g: 25, carbs_g: 4, fat_g: 1.5 },
      { name: 'Egg Whites × 4', calories: 68, protein_g: 14, carbs_g: 1, fat_g: 0.4 },
      { name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
    ],
  },
  {
    name: 'Lean Chicken Lunch',
    description: '~620 kcal · 55g protein',
    source: 'preset',
    meal_type: 'LUNCH',
    items: [
      { name: 'Grilled Chicken Breast (150g)', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4 },
      { name: 'Brown Rice (cooked, 150g)', calories: 165, protein_g: 3.5, carbs_g: 34, fat_g: 1.3 },
      { name: 'Mixed Vegetables', calories: 55, protein_g: 3, carbs_g: 10, fat_g: 0.5 },
      { name: 'Olive Oil (1 tsp)', calories: 40, protein_g: 0, carbs_g: 0, fat_g: 4.5 },
    ],
  },
  {
    name: 'Balanced Dinner',
    description: '~700 kcal · 50g protein',
    source: 'preset',
    meal_type: 'DINNER',
    items: [
      { name: 'Salmon (150g)', calories: 280, protein_g: 38, carbs_g: 0, fat_g: 13 },
      { name: 'Sweet Potato (200g)', calories: 172, protein_g: 3.2, carbs_g: 40, fat_g: 0.3 },
      { name: 'Broccoli (150g)', calories: 51, protein_g: 4.3, carbs_g: 10, fat_g: 0.6 },
      { name: 'Greek Yogurt (100g)', calories: 97, protein_g: 9, carbs_g: 4, fat_g: 5 },
    ],
  },
  {
    name: 'Pre-Workout Snack',
    description: '~300 kcal · 20g protein',
    source: 'preset',
    meal_type: 'SNACK',
    items: [
      { name: 'Rice Cakes × 2', calories: 70, protein_g: 1.4, carbs_g: 14, fat_g: 0.4 },
      { name: 'Peanut Butter (1 tbsp)', calories: 94, protein_g: 4, carbs_g: 3, fat_g: 8 },
      { name: 'Whey Protein Shake', calories: 120, protein_g: 25, carbs_g: 4, fat_g: 1.5 },
    ],
  },
  {
    name: 'Post-Workout Recovery',
    description: '~400 kcal · 40g protein',
    source: 'preset',
    meal_type: 'SNACK',
    items: [
      { name: 'Whey Protein (2 scoops)', calories: 240, protein_g: 50, carbs_g: 8, fat_g: 3 },
      { name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
      { name: 'Milk (200ml)', calories: 98, protein_g: 6.6, carbs_g: 9.4, fat_g: 3.6 },
    ],
  },
];

// ────────────────────────────────────────────────────

function totalMacros(items: MealTemplate['items']) {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      protein_g: acc.protein_g + it.protein_g,
      carbs_g: acc.carbs_g + it.carbs_g,
      fat_g: acc.fat_g + it.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

const SOURCE_ICONS = {
  yesterday: Copy,
  plan: BookMarked,
  preset: Utensils,
} as const;

const SOURCE_LABELS = {
  yesterday: "Yesterday's",
  plan: 'Meal Plan',
  preset: 'Template',
} as const;

export function MealTemplateSheet({ visible, mealType, yesterdayMeals, planMealPayload, onApply, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<'yesterday' | 'preset'>('yesterday');

  const templates = useMemo<MealTemplate[]>(() => {
    const out: MealTemplate[] = [];

    // Yesterday's meals for this meal_type
    const yesterdayFiltered = (yesterdayMeals ?? []).filter((m) => m.meal_type === mealType);
    if (yesterdayFiltered.length > 0) {
      out.push({
        id: 'yesterday',
        name: "Yesterday's Meal",
        description: `${yesterdayFiltered.length} item${yesterdayFiltered.length > 1 ? 's' : ''} · repeat exactly`,
        source: 'yesterday',
        meal_type: mealType,
        items: yesterdayFiltered.map((m) => ({
          name: m.name,
          calories: m.calories,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          servings: (m.servings ?? m.quantity) ?? 1,
        })),
      });
    }

    // Plan meal_payload
    if (planMealPayload) {
      try {
        const payload = typeof planMealPayload === 'string' ? JSON.parse(planMealPayload) : planMealPayload;
        const planItems = Array.isArray(payload[mealType])
          ? payload[mealType]
          : Array.isArray(payload)
          ? payload.filter((m: any) => m.meal_type === mealType)
          : [];
        if (planItems.length > 0) {
          out.push({
            id: 'plan',
            name: 'Today\'s Plan Meal',
            description: `${planItems.length} item${planItems.length > 1 ? 's' : ''} from program`,
            source: 'plan',
            meal_type: mealType,
            items: planItems.map((m: any) => ({
              name: m.name || m.food_name || 'Food',
              calories: m.calories ?? 0,
              protein_g: m.protein_g ?? 0,
              carbs_g: m.carbs_g ?? 0,
              fat_g: m.fat_g ?? 0,
              servings: m.servings ?? 1,
            })),
          });
        }
      } catch {}
    }

    // Presets for this meal type
    const presets = PRESET_TEMPLATES.filter((t) => t.meal_type === mealType).map((t, i) => ({
      ...t,
      id: `preset-${i}`,
    }));
    out.push(...presets);

    return out;
  }, [mealType, yesterdayMeals, planMealPayload]);

  const MEAL_TYPE_LABELS: Record<string, string> = {
    BREAKFAST: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack / Pre-Workout',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <BookMarked size={18} color={colors.primaryLight} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>Meal Templates</Text>
              <Text style={styles.subtitle}>{MEAL_TYPE_LABELS[mealType] ?? mealType}</Text>
            </View>
            <PressableScale haptic="selection" onPress={onClose} style={styles.closeBtn}>
              <ChevronDown size={20} color={colors.textSecondary} />
            </PressableScale>
          </View>

          {templates.length === 0 ? (
            <View style={styles.empty}>
              <Utensils size={32} color={colors.border} />
              <Text style={styles.emptyText}>No templates available yet.</Text>
              <Text style={styles.emptyHint}>Log meals consistently and they will appear here.</Text>
            </View>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {templates.map((tmpl) => {
                const macros = totalMacros(tmpl.items);
                const Icon = SOURCE_ICONS[tmpl.source];
                return (
                  <View key={tmpl.id} style={styles.templateCard}>
                    {/* Card header */}
                    <View style={styles.templateHeader}>
                      <View style={styles.sourceChip}>
                        <Icon size={11} color={colors.primaryLight} />
                        <Text style={styles.sourceChipText}>{SOURCE_LABELS[tmpl.source]}</Text>
                      </View>
                      <Text style={styles.templateName}>{tmpl.name}</Text>
                      <Text style={styles.templateDesc}>{tmpl.description}</Text>
                    </View>

                    {/* Macro summary */}
                    <View style={styles.macroRow}>
                      <MacroPill label="kcal" value={Math.round(macros.calories)} color={colors.amber} />
                      <MacroPill label="P" value={Math.round(macros.protein_g)} color={colors.primaryLight} unit="g" />
                      <MacroPill label="C" value={Math.round(macros.carbs_g)} color={colors.cyan} unit="g" />
                      <MacroPill label="F" value={Math.round(macros.fat_g)} color={colors.violet} unit="g" />
                    </View>

                    {/* Items preview */}
                    <View style={styles.itemsList}>
                      {tmpl.items.slice(0, 4).map((item, i) => (
                        <Text key={i} style={styles.itemText} numberOfLines={1}>
                          · {item.name}
                        </Text>
                      ))}
                      {tmpl.items.length > 4 ? (
                        <Text style={styles.itemMore}>+{tmpl.items.length - 4} more items</Text>
                      ) : null}
                    </View>

                    {/* Apply button */}
                    <PressableScale
                      haptic="medium"
                      onPress={() => {
                        onApply(tmpl.items, tmpl.source);
                        onClose();
                      }}
                      style={styles.applyBtn}
                      accessibilityLabel={`Use ${tmpl.name} template`}
                    >
                      <Zap size={14} color="#FFFFFF" />
                      <Text style={styles.applyBtnText}>Use This Template</Text>
                    </PressableScale>
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MacroPill({ label, value, color, unit = '' }: { label: string; value: number; color: string; unit?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.macroPill}>
      <Text style={[styles.macroPillValue, { color }]}>{value}{unit}</Text>
      <Text style={styles.macroPillLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },

  templateCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  templateHeader: { marginBottom: spacing.sm },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  sourceChipText: { fontSize: 11, fontWeight: '700', color: colors.primaryLight },
  templateName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  templateDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
  },
  macroPillValue: { fontSize: 13, fontWeight: '800' },
  macroPillLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 1 },

  itemsList: { marginBottom: spacing.md },
  itemText: { fontSize: 12, color: colors.textSecondary, lineHeight: 19 },
  itemMore: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },

  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
  },
  applyBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
  emptyHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
}));
