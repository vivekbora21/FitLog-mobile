import type { PlanMessage } from '../../types';

/**
 * Single localisable copy catalog for every engine message code (spec v1.6
 * section 9: "keep wording in one localisable file"). Never render
 * `PlanRoadmap.warnings` or `PlanRoadmap.feasibility.message` directly --
 * both come from a legacy pre-engine template that still uses the word
 * "safe" (see plans/services/plan_generator.py `_assess_feasibility` and
 * plans/services/engine_adapter.py `_MESSAGE_TEMPLATES`), which copy rule 9
 * forbids. This file is the only place plan-builder message text lives.
 *
 * Copy rules applied throughout (spec section 9):
 * - never "safe"; use "within the typical range" / "estimate" / "about".
 * - every projection is an estimate, never a promise.
 * - gentle pace is neutral ("gradual"), never "too slow".
 * - aggressive pace is a caution with an action, never a scolding.
 */
export function messageText(message: PlanMessage): string {
  const p = message.params || {};
  switch (message.code) {
    case 'PROFILE_OUT_OF_RANGE':
      return 'One of your profile values (age, height or weight) is outside the supported range.';
    case 'DURATION_INVALID':
      return 'Plan length must be a whole number of days in the supported range.';
    case 'DAYS_PER_WEEK_INVALID':
      return 'Choose a training frequency between 3 and 6 days a week.';
    case 'TRAINING_DAYS_MISMATCH':
      return `Pick ${p.required} day${p.required === 1 ? '' : 's'} (${p.selected} selected).`;
    case 'GOAL_WEIGHT_REQUIRED':
      return 'Enter a goal weight to continue.';
    case 'GOAL_DIRECTION_INVALID':
      return "That goal weight doesn't match this goal's direction. Try Recomp or Focus instead, or adjust the number.";
    case 'GOAL_BMI_TOO_LOW':
      return p.min_goal_weight_kg != null
        ? `That goal is lower than a healthy range for your height. About ${p.min_goal_weight_kg} kg is the lowest we'd suggest.`
        : "That goal is lower than a healthy range for your height.";
    case 'PACE_ABOVE_LIMIT':
      return p.extend_to_days != null
        ? `This goal and timeline ask for a pace beyond our upper limit. Extend to about ${p.extend_to_days} days, or choose a closer goal.`
        : 'This goal and timeline ask for a pace beyond our upper limit. Choose a closer goal or a longer timeline.';
    case 'PACE_AGGRESSIVE':
      return p.extend_to_days != null
        ? `This is an aggressive pace. You can proceed, or extend to about ${p.extend_to_days} days for a more typical pace.`
        : 'This is an aggressive pace. You can proceed, or choose a longer timeline for a more typical pace.';
    case 'CALORIES_RAISED_TO_FLOOR':
      return 'Your calorie target was raised to a sensible minimum, so the estimated change is gentler than the goal implied.';
    case 'CONSECUTIVE_DAYS':
      return `${p.run} training days in a row is more than we'd usually suggest (${p.limit} max). Consider spreading them out.`;
    case 'BEGINNER_HIGH_FREQUENCY':
      return 'Most people new to training progress well on 3-4 days a week.';
    case 'CUT_HIGH_FREQUENCY_RECOVERY':
      return 'Six training days with this pace leaves little room for recovery. Consider fewer days or a gentler pace.';
    case 'TARGET_NOT_MOVING_TOWARD_GOAL':
      return "This calorie target will not move you toward your goal weight.";
    case 'GOAL_NOT_REACHED_IN_TIME':
      return p.projected_end_weight_kg != null
        ? `At this rate, you'd end the plan at about ${Number(p.projected_end_weight_kg).toFixed(1)} kg rather than your goal.`
        : "At this rate, the plan won't quite reach your goal in the time given.";
    case 'RECOMP_OVERRIDE_LARGE':
      return 'This calorie target is no longer close to a recomposition setting. Consider Cut or Bulk instead.';
    case 'FOCUS_GOAL_SUGGESTS_CUT_OR_BULK':
      return 'That goal weight is a meaningful change. Cut or Bulk may fit better than Focus.';
    case 'MACROS_TIGHT':
      return 'Carbs are constrained to stay above a sensible floor, so macros are tight at this calorie level.';
    case 'MACROS_UNUSUAL':
      return 'This macro split is outside the usual range. You can proceed if it fits your approach.';
    case 'OVERRIDE_INVALID':
      return 'That calorie or macro edit is outside the range we can support here.';
    case 'OVERRIDE_MODE_REQUIRED':
      return 'An edited target needs to be re-applied for the current goal.';
    case 'OVERRIDE_CLEARED_MODE_CHANGED':
      return 'Your calorie edits were reset for the new goal.';
    case 'OVERRIDE_CONFLICT':
      return 'Only one kind of edit (calories or macros) can be applied at a time.';
    case 'VOLUME_OUTSIDE_RANGE':
      return `${p.muscle_group}: ${p.weekly_sets} sets/week on this schedule, outside the ${String(
        p.experience
      ).toLowerCase()} range of ${p.min_sets}-${p.max_sets}.`;
    case 'MINOR_RESTRICTED_MODE':
      return 'Only Focus is available under 18.';
    case 'LIMITED_EXERCISE_OPTIONS':
      return `${p.muscle_group ?? 'A muscle group'} has limited exercise options at this equipment level.`;
    default:
      return message.code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) + '.';
  }
}

/** Reads `extend_to_days` off a PACE_ABOVE_LIMIT/PACE_AGGRESSIVE message, if present. */
export function extendToDaysFrom(messages: PlanMessage[]): number | null {
  const m = messages.find((msg) => msg.code === 'PACE_ABOVE_LIMIT' || msg.code === 'PACE_AGGRESSIVE');
  const n = m?.params?.extend_to_days;
  return typeof n === 'number' ? n : null;
}

export function blockMessages(messages: PlanMessage[] | undefined): PlanMessage[] {
  return (messages || []).filter((m) => m.severity === 'block');
}

export function warnMessages(messages: PlanMessage[] | undefined): PlanMessage[] {
  return (messages || []).filter((m) => m.severity === 'warn');
}

export function infoMessages(messages: PlanMessage[] | undefined): PlanMessage[] {
  return (messages || []).filter((m) => m.severity === 'info');
}

/** First block-severity message's text, suitable for "disabled because: ..." copy. */
export function firstBlockReason(messages: PlanMessage[] | undefined): string | null {
  const blocks = blockMessages(messages);
  return blocks.length ? messageText(blocks[0]) : null;
}
