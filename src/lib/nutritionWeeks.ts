import type { MacroTarget, NutritionHistoryDay, WeeklyNutritionDayItem, WeeklyNutritionSummary } from '../types';
import { parseDateKey, shiftDateKey, toDateKey } from './format';

export interface WeeklyMacroRatio {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

/**
 * Calculates calendar weeks (Monday–Sunday) from nutrition history.
 * Ensures consistent weekly averages across the Nutrition and Progress screens.
 */
export function computeWeeklyNutritionSummaries(
  history: NutritionHistoryDay[],
  defaultTargets?: MacroTarget | null,
  planMode: string = 'CUT'
): WeeklyNutritionSummary[] {
  if (!history || history.length === 0) return [];

  const today = new Date();
  const todayKey = toDateKey(today);

  // Map history by date key
  const historyMap = new Map<string, NutritionHistoryDay>();
  for (const item of history) {
    historyMap.set(item.date, item);
  }

  // Calculate Monday of current week
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + diffToMonday);

  // Find earliest date in history
  const sortedDates = [...history.map((h) => h.date)].sort();
  const earliestDateKey = sortedDates[0] || todayKey;
  const earliestDate = parseDateKey(earliestDateKey);
  const earliestDow = earliestDate.getDay();
  const earliestDiffToMonday = earliestDow === 0 ? -6 : 1 - earliestDow;
  const earliestMonday = new Date(earliestDate);
  earliestMonday.setDate(earliestDate.getDate() + earliestDiffToMonday);

  const fallbackCalories = defaultTargets?.daily_calories || 2200;
  const fallbackProtein = defaultTargets?.protein_g || 160;
  const fallbackCarbs = defaultTargets?.carbs_g || 240;
  const fallbackFat = defaultTargets?.fat_g || 65;
  const fallbackWater = defaultTargets?.water_ml || 2500;

  const summaries: WeeklyNutritionSummary[] = [];
  const cursorMonday = new Date(currentMonday);
  let weekIndex = 0;

  while (cursorMonday >= earliestMonday) {
    const mondayKey = toDateKey(cursorMonday);
    const sunday = new Date(cursorMonday);
    sunday.setDate(cursorMonday.getDate() + 6);
    const sundayKey = toDateKey(sunday);

    const daysInWeek: WeeklyNutritionDayItem[] = [];
    let weekTargetCalories = fallbackCalories;
    let weekTargetProtein = fallbackProtein;
    let weekTargetCarbs = fallbackCarbs;
    let weekTargetFat = fallbackFat;
    let weekTargetWater = fallbackWater;

    for (let i = 0; i < 7; i++) {
      const d = new Date(cursorMonday);
      d.setDate(cursorMonday.getDate() + i);
      const dKey = toDateKey(d);
      const isToday = dKey === todayKey;
      const isFuture = dKey > todayKey;

      const hist = historyMap.get(dKey);
      if (hist) {
        if (hist.target_calories) weekTargetCalories = hist.target_calories;
        if (hist.target_protein) weekTargetProtein = hist.target_protein;
        if (hist.target_carbs) weekTargetCarbs = hist.target_carbs;
        if (hist.target_fat) weekTargetFat = hist.target_fat;
        if (hist.target_water) weekTargetWater = hist.target_water;

        daysInWeek.push({
          date: dKey,
          weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
          day_number: d.getDate(),
          total_calories: hist.total_calories || 0,
          total_protein: hist.total_protein || 0,
          total_carbs: hist.total_carbs || 0,
          total_fat: hist.total_fat || 0,
          water_consumed_ml: hist.water_consumed_ml || 0,
          has_logged: hist.has_logged,
          is_today: isToday,
          is_future: isFuture,
          target_calories: hist.target_calories || weekTargetCalories,
        });
      } else {
        daysInWeek.push({
          date: dKey,
          weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
          day_number: d.getDate(),
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
          water_consumed_ml: 0,
          has_logged: false,
          is_today: isToday,
          is_future: isFuture,
          target_calories: weekTargetCalories,
        });
      }
    }

    const loggedDays = daysInWeek.filter((d) => d.has_logged);
    const loggedCount = loggedDays.length;

    const avgCalories = loggedCount > 0
      ? Math.round(loggedDays.reduce((acc, d) => acc + d.total_calories, 0) / loggedCount)
      : 0;
    const avgProtein = loggedCount > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.total_protein, 0) / loggedCount) * 10) / 10
      : 0;
    const avgCarbs = loggedCount > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.total_carbs, 0) / loggedCount) * 10) / 10
      : 0;
    const avgFat = loggedCount > 0
      ? Math.round((loggedDays.reduce((acc, d) => acc + d.total_fat, 0) / loggedCount) * 10) / 10
      : 0;
    const avgWater = loggedCount > 0
      ? Math.round(loggedDays.reduce((acc, d) => acc + d.water_consumed_ml, 0) / loggedCount)
      : 0;

    const calDiff = loggedCount > 0 ? avgCalories - weekTargetCalories : 0;
    const netCalDiff = calDiff * loggedCount;

    const calAdherence = weekTargetCalories > 0
      ? Math.round((avgCalories / weekTargetCalories) * 100)
      : 0;
    const proteinAdherence = weekTargetProtein > 0
      ? Math.round((avgProtein / weekTargetProtein) * 100)
      : 0;
    const adherenceRate = Math.round((loggedCount / 7) * 100);

    let label: string;
    if (weekIndex === 0) {
      label = 'This Week';
    } else if (weekIndex === 1) {
      label = 'Last Week';
    } else {
      const m1 = cursorMonday.toLocaleDateString('en-US', { month: 'short' });
      const m2 = sunday.toLocaleDateString('en-US', { month: 'short' });
      if (m1 === m2) {
        label = `${m1} ${cursorMonday.getDate()} – ${sunday.getDate()}`;
      } else {
        label = `${m1} ${cursorMonday.getDate()} – ${m2} ${sunday.getDate()}`;
      }
    }

    let copilotInsight = '';
    if (loggedCount === 0) {
      copilotInsight = 'No meals logged yet this week. Log daily food to see your weekly average nutrients.';
    } else if (planMode === 'CUT') {
      if (avgCalories <= weekTargetCalories) {
        copilotInsight = `Avg ${avgCalories.toLocaleString()} kcal is ${Math.abs(calDiff).toLocaleString()} kcal under your ${weekTargetCalories.toLocaleString()} kcal ceiling. Deficit on track across ${loggedCount} day${loggedCount > 1 ? 's' : ''}!`;
      } else {
        copilotInsight = `Avg ${avgCalories.toLocaleString()} kcal is ${calDiff.toLocaleString()} kcal over deficit ceiling. Tighten remaining days to protect your weekly deficit.`;
      }
    } else if (planMode === 'BULK') {
      if (avgCalories >= weekTargetCalories) {
        copilotInsight = `Avg ${avgCalories.toLocaleString()} kcal hits your ${weekTargetCalories.toLocaleString()} kcal surplus floor across ${loggedCount} day${loggedCount > 1 ? 's' : ''}!`;
      } else {
        copilotInsight = `Avg ${avgCalories.toLocaleString()} kcal is ${Math.abs(calDiff).toLocaleString()} kcal below minimum floor. Lift intake for growth.`;
      }
    } else {
      copilotInsight = `Weekly average ${avgCalories.toLocaleString()} kcal (${calAdherence}% of target) with ${avgProtein}g protein across ${loggedCount}/7 logged days.`;
    }

    summaries.push({
      week_start: mondayKey,
      week_end: sundayKey,
      label,
      logged_count: loggedCount,
      total_days: 7,
      avg_calories: avgCalories,
      avg_protein: avgProtein,
      avg_carbs: avgCarbs,
      avg_fat: avgFat,
      avg_water_ml: avgWater,
      target_calories: weekTargetCalories,
      target_protein: weekTargetProtein,
      target_carbs: weekTargetCarbs,
      target_fat: weekTargetFat,
      target_water: weekTargetWater,
      net_calorie_diff: netCalDiff,
      calorie_adherence_pct: calAdherence,
      protein_adherence_pct: proteinAdherence,
      adherence_rate_pct: adherenceRate,
      copilot_insight: copilotInsight,
      days: daysInWeek,
    });

    // Move backwards one week (7 days)
    cursorMonday.setDate(cursorMonday.getDate() - 7);
    weekIndex += 1;
  }

  return summaries;
}

/**
 * Calculates caloric macronutrient ratio (percentage of calories from P, C, F)
 */
export function calculateMacroRatio(proteinG: number, carbsG: number, fatG: number): WeeklyMacroRatio {
  const pCal = Math.max(0, proteinG) * 4;
  const cCal = Math.max(0, carbsG) * 4;
  const fCal = Math.max(0, fatG) * 9;
  const total = pCal + cCal + fCal;

  if (total <= 0) {
    return { proteinPct: 30, carbsPct: 45, fatPct: 25 };
  }

  const proteinPct = Math.round((pCal / total) * 100);
  const carbsPct = Math.round((cCal / total) * 100);
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

  return { proteinPct, carbsPct, fatPct };
}
