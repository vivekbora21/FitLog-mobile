export * from './types';

// Shared utility helpers
export const formatNumber = (value: number | null | undefined, fallback: string = '--'): string => {
  if (value == null || isNaN(value)) return fallback;
  return Math.round(value).toLocaleString();
};

export const formatDecimal = (value: number | null | undefined, decimals: number = 1, fallback: string = '--'): string => {
  if (value == null || isNaN(value)) return fallback;
  return value.toFixed(decimals);
};

export const calculateMacroPercentage = (consumed: number, target: number): number => {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((consumed / target) * 100));
};
