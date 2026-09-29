import type { JourneyMode } from '../../types';

export type WizardPath = 'blueprint' | 'custom';

/** Local, string-backed form state for the details step (mirrors Input's controlled text fields). */
export interface WizardDetails {
  duration: string;
  daysPerWeek: number;
  weekdays: number[];
  currentWeight: string;
  goalWeight: string;
  height: string;
  age: string;
  sex: 'MALE' | 'FEMALE' | null;
}

export const defaultWizardDetails = (overrides?: Partial<WizardDetails>): WizardDetails => ({
  duration: '60',
  daysPerWeek: 4,
  weekdays: [1, 2, 3, 5],
  currentWeight: '',
  goalWeight: '',
  height: '',
  age: '',
  sex: null,
  ...overrides,
});

export interface WizardSelection {
  path: WizardPath;
  mode: JourneyMode | null;
  blueprintSlug: string | null;
}
