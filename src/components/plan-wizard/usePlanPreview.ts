import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client';
import { parseNumberInput } from '../../lib/format';
import type { PlanPreviewPayload } from '../../types';
import type { PlanWizardState } from './types';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Builds the live `/api/plans/preview/` payload from wizard state, or null
 * while required primitive fields aren't filled in yet (not a semantic
 * validation rule -- just enough to make a well-formed request; every
 * semantic rule, including GOAL_WEIGHT_REQUIRED for a blank Cut/Bulk goal,
 * is the engine's job -- spec section 5: "The frontend never blocks on its
 * own rules."). */
export function buildPreviewPayload(state: PlanWizardState): PlanPreviewPayload | null {
  if (!state.mode || !state.sex) return null;
  const age = Math.round(parseNumberInput(state.age) ?? 0);
  const height = parseNumberInput(state.height) ?? 0;
  const weight = parseNumberInput(state.currentWeight) ?? 0;
  const duration = Math.round(parseNumberInput(state.durationDays) ?? 0);
  if (!age || !height || !weight || !duration) return null;
  if (state.weekdays.length !== state.daysPerWeek) return null;

  const goalWeight = parseNumberInput(state.goalWeight);

  return {
    mode: state.mode,
    duration_days: duration,
    days_per_week: state.daysPerWeek,
    weekdays: state.weekdays,
    current_weight_kg: weight,
    goal_weight_kg: goalWeight ?? undefined,
    height_cm: height,
    age,
    sex: state.sex,
    equipment_level: state.equipment ?? undefined,
    experience: state.experience ?? undefined,
    split_slug: state.splitSlug ?? undefined,
  };
}

/** Spec v1.6 section 7.4: "TanStack Query (300 ms debounce, keep previous
 * data while refetching)". Backs the live pace line (About you), the
 * schedule warnings (Your schedule), the split recommendation / V-21
 * NO_SUPPORTED_SPLIT check (Training style) and the Review screen -- all
 * the same query, so every screen always agrees (spec acceptance 11.4:
 * "The live pace line, review screen and saved plan show identical numbers
 * for the same inputs"). */
export function usePlanPreview(state: PlanWizardState, options?: { enabled?: boolean }) {
  const debounced = useDebounced(state, 300);
  const payload = useMemo(() => buildPreviewPayload(debounced), [debounced]);
  const enabled = (options?.enabled ?? true) && !!payload;

  const query = useQuery({
    queryKey: ['planPreview', payload],
    queryFn: () => api.previewPlan(payload as PlanPreviewPayload),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });

  return { ...query, payload, isDebouncing: JSON.stringify(state) !== JSON.stringify(debounced) };
}
