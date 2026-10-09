import { kv } from './kv';

const SEEN_KEY = 'fitlog_seen_achievement_tiers_v1';

function readSeen(): Set<string> | null {
  const raw = kv.get(SEEN_KEY);
  if (raw === null) return null;
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return null;
  }
}

function writeSeen(keys: Set<string>): void {
  kv.set(SEEN_KEY, JSON.stringify(Array.from(keys)));
}

/**
 * Given the tier keys currently earned (e.g. "streak:Lit"), returns the ones
 * earned for the first time since the last call — never includes keys from
 * a device's very first run, so upgrading to this feature doesn't flood an
 * existing user with toasts for milestones they already passed.
 */
export function diffNewlyEarnedTiers(earnedKeys: string[]): string[] {
  const seen = readSeen();
  if (seen === null) {
    writeSeen(new Set(earnedKeys));
    return [];
  }
  const newly = earnedKeys.filter((k) => !seen.has(k));
  if (newly.length > 0) {
    writeSeen(new Set([...seen, ...earnedKeys]));
  }
  return newly;
}
