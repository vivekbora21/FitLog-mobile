import type { UserProfile } from '../types';

/** Profile is "set up" once the fields needed for calorie/macro recommendations exist. */
export function needsOnboarding(profile?: UserProfile | null): boolean {
  return !profile?.height_cm || !profile?.weight_kg || !profile?.date_of_birth || !profile?.sex;
}

export const onboardingSkipKey = (userId: string | number) => `fitlog_onboarding_skipped_${userId}`;
