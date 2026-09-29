import type { JourneyMode } from '../../types';
import { parseNumberInput } from '../../lib/format';
import { MAX_PLAN_DAYS, MIN_PLAN_DAYS, STEADY_MODE_MAX_GOAL_DELTA_KG } from './constants';
import type { WizardDetails } from './types';

/**
 * Client-side mirror of the backend's own checks (see PlanPreviewSerializer), so the user
 * sees a friendly message before submitting rather than only getting a 400 back.
 */
export function validateDetails(details: WizardDetails, mode: JourneyMode | null): string | null {
  const duration = parseNumberInput(details.duration);
  if (!duration || duration < MIN_PLAN_DAYS || duration > MAX_PLAN_DAYS) {
    return `Plan length must be between ${MIN_PLAN_DAYS} and ${MAX_PLAN_DAYS} days.`;
  }

  if (details.weekdays.length !== details.daysPerWeek) {
    return `Select exactly ${details.daysPerWeek} training day${details.daysPerWeek === 1 ? '' : 's'} of the week.`;
  }

  const currentWeight = parseNumberInput(details.currentWeight);
  if (!currentWeight || currentWeight <= 0) {
    return 'Enter your current weight.';
  }

  const height = parseNumberInput(details.height);
  if (!height || height <= 0) {
    return 'Enter your height.';
  }

  const age = parseNumberInput(details.age);
  if (!age || age <= 0) {
    return 'Enter your age.';
  }

  if (!details.sex) {
    return 'Select your sex.';
  }

  const goalWeight = parseNumberInput(details.goalWeight);
  if (goalWeight != null && (mode === 'FOCUS' || mode === 'HABIT')) {
    const delta = Math.abs(goalWeight - currentWeight);
    if (delta > STEADY_MODE_MAX_GOAL_DELTA_KG) {
      return `${mode === 'FOCUS' ? 'Focus' : 'Habit'} plans expect a goal weight within ${STEADY_MODE_MAX_GOAL_DELTA_KG} kg of your current weight.`;
    }
  }

  return null;
}
