// Pure scaling/labeling helpers shared by LineChart and BarChart, factored out of
// the near-identical domain-padding and axis-labeling math that used to be
// duplicated per chart (WeightSvgChart, DailyNutrientChart).

export interface Domain {
  min: number;
  max: number;
}

/** Computes a y-domain with headroom so lines/points never touch the chart edges. */
export function computeNiceDomain(
  values: number[],
  opts?: { paddingPct?: number; minPadding?: number }
): Domain {
  const paddingPct = opts?.paddingPct ?? 0.15;
  const minPadding = opts?.minPadding ?? 1.5;
  if (values.length === 0) return { min: 0, max: minPadding * 2 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  // Near-flat series (or a single point) still need vertical room to render legibly.
  const padding = spread < minPadding * 0.3 ? minPadding : Math.max(spread * paddingPct, minPadding * 0.5);
  return { min: min - padding, max: max + padding };
}

/** Builds a linear interpolator mapping a value from `domain` into `range`. */
export function scaleLinear(domain: Domain, range: Domain): (value: number) => number {
  const domainSpan = domain.max - domain.min || 1;
  const rangeSpan = range.max - range.min;
  return (value: number) => range.min + ((value - domain.min) / domainSpan) * rangeSpan;
}

const NICE_FACTORS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Rounds a positive value up to a human-friendly axis bound (e.g. 2,520 -> 3,000; 1.16 -> 1.2). */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  return (NICE_FACTORS.find((n) => n >= f - 1e-9) ?? 10) * exp;
}

/**
 * Drops labels that would sit closer than `minGap` px to a neighbour. The last label
 * always survives (it's the most recent data point), so its crowded predecessor goes.
 */
export function spaceLabels<L extends { index: number }>(
  labels: L[],
  xFor: (index: number) => number,
  minGap: number
): L[] {
  if (labels.length <= 1) return labels;
  const kept: L[] = [];
  const last = labels[labels.length - 1];
  const lastX = xFor(last.index);
  for (const l of labels.slice(0, -1)) {
    const x = xFor(l.index);
    const prev = kept[kept.length - 1];
    if (prev && x - xFor(prev.index) < minGap) continue;
    if (lastX - x < minGap) continue;
    kept.push(l);
  }
  kept.push(last);
  return kept;
}

/** Picks up to `maxLabels` evenly-spaced indices from `items`, always including the last one. */
export function buildEvenLabels<T>(
  items: T[],
  getLabel: (item: T, index: number) => string,
  maxLabels = 5
): { index: number; label: string }[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ index: 0, label: getLabel(items[0], 0) }];

  const step = Math.max(1, Math.floor((items.length - 1) / (maxLabels - 1)));
  const indices = new Set<number>();
  for (let i = 0; i < items.length; i += step) indices.add(Math.min(i, items.length - 1));
  indices.add(items.length - 1);

  return [...indices].sort((a, b) => a - b).map((i) => ({ index: i, label: getLabel(items[i], i) }));
}
