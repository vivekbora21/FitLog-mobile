import type { Palette } from '../../theme';

// One color always means the same metric across every Progress chart, so a
// returning user doesn't have to re-learn what "that teal line" means per screen.
export type ChartSeriesKey =
  | 'weight'
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'burn'
  | 'measurement'
  | 'target';

export function chartSeriesColor(colors: Palette, key: ChartSeriesKey): string {
  switch (key) {
    case 'weight':
      return colors.primaryLight;
    case 'calories':
      return colors.primaryLight;
    case 'protein':
      return colors.cyan;
    case 'carbs':
      return colors.amber;
    case 'fat':
      return colors.violet;
    case 'burn':
      return colors.rose;
    case 'measurement':
      return colors.cyan;
    case 'target':
      return colors.cyan;
    default:
      return colors.primaryLight;
  }
}
