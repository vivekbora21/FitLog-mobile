export interface UserProfile {
  id: string;
  date_of_birth?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  sex?: 'MALE' | 'FEMALE' | '';
  activity_level?: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'HIGH' | 'ATHLETE';
  fitness_goal: string;
  unit_preference: string;
  bio: string;
}

export interface GymMembership {
  id: string;
  user?: User;
  gym?: string;
  gym_id?: string;
  gym_name?: string;
  gym_slug?: string;
  role: 'OWNER' | 'TRAINER' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  share_workouts_with_trainers: boolean;
  share_progress_with_trainers: boolean;
  share_nutrition_with_trainers?: boolean;
  share_body_measurements?: boolean;
  created_at?: string;
}

export interface User {
  id: string | number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url?: string | null;
  profile?: UserProfile;
  memberships: GymMembership[];
}

export interface MuscleGroup {
  id: string;
  name: string;
  slug: string;
}

export interface EquipmentType {
  id: string;
  name: string;
  slug: string;
}

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  gym?: string | null;
  gym_name?: string | null;
  primary_muscle: string;
  primary_muscle_name: string;
  secondary_muscles: string[];
  equipment: string;
  equipment_name: string;
  instructions: string;
  video_url?: string | null;
  is_global: boolean;
}

export interface RoutineExercise {
  id: string;
  exercise: string;
  exercise_name: string;
  primary_muscle: string;
  order: number;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
  notes: string;
  target_rpe?: number | null;
  suggested_weight_kg?: number | null;
  focus?: string;
  progression?: ProgressionRecommendation | null;
}

/** Server-computed next-session prescription (backend/workouts/progression.py). */
export interface ProgressionRecommendation {
  action: 'START' | 'HOLD' | 'INCREASE';
  recommended_weight_kg: number | null;
  target_reps: number[];
  note: string;
  last_session: { date: string; weight_kg: number; reps: number[] } | null;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  gym?: string | null;
  user?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  is_gym_template: boolean;
  exercises: RoutineExercise[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  id?: string;
  set_number: number;
  set_type: 'WARMUP' | 'NORMAL' | 'DROP' | 'FAILURE';
  weight_kg: number;
  reps: number;
  rpe?: number | null;
  completed: boolean;
}

export interface WorkoutExercise {
  id?: string;
  exercise: string;
  exercise_name: string;
  primary_muscle: string;
  order: number;
  rest_seconds: number;
  notes: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  user: string;
  user_email: string;
  user_name: string;
  gym?: string | null;
  gym_name?: string | null;
  assigned_workout?: string | null;
  routine?: string | null;
  title: string;
  started_at: string;
  completed_at?: string | null;
  duration_seconds: number;
  overall_rpe?: number | null;
  notes: string;
  exercises: WorkoutExercise[];
  total_volume_kg: number;
  created_at: string;
}

export interface AssignedWorkout {
  id: string;
  gym: string;
  gym_name: string;
  trainer: string;
  trainer_name: string;
  client: string;
  client_name: string;
  routine: string;
  routine_name: string;
  routine_details?: Routine;
  scheduled_date: string;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  trainer_feedback: string;
  feedback_date?: string | null;
  created_at: string;
}

export interface MealEntry {
  id: string;
  meal_type: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  name: string;
  food?: string | null;
  servings?: number;
  quantity?: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  time_logged: string;
}

export interface RecentFood {
  id: string;
  food_id?: string | null;
  name: string;
  serving_label: string;
  serving_grams?: number | null;
  quantity: number;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  is_custom: boolean;
  last_logged_date: string;
}

export interface Food {
  id: string;
  name: string;
  serving_label: string;
  serving_grams?: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_custom: boolean;
}

export type RecommendedTargets =
  | { available: false; missing: string[] }
  | {
      available: true;
      inputs: { weight_kg: number; weight_source: string; height_cm: number; age_years: number; sex: string; activity_level: string };
      bmr: number;
      activity_factor: number;
      tdee: number;
      goal_source: string;
      calorie_adjustment: number;
      protein_g_per_kg: number;
      daily_calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };

export interface NutritionDay {
  id: string;
  user: string;
  date: string;
  water_consumed_ml: number;
  notes: string;
  meals: MealEntry[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

export interface NutritionDayResponse {
  day: NutritionDay;
  targets: MacroTarget;
  yesterday_meals?: MealEntry[];
}

export interface MacroTarget {
  id: string;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  daily_steps: number;
  sleep_hours: number;
  /** null = follow the active plan */
  weekly_workouts: number | null;
  /** null = follow the active plan's cardio phase */
  weekly_cardio_minutes: number | null;
}

export type TargetField =
  | 'daily_calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'water_ml'
  | 'daily_steps' | 'sleep_hours' | 'weekly_workouts' | 'weekly_cardio_minutes';

/** GET/PUT /nutrition/macro-targets/ */
export interface TargetsPayload extends MacroTarget {
  effective: { weekly_workouts: number; weekly_cardio_minutes: number };
  suggested: Partial<Record<TargetField, number>>;
  limits: Record<TargetField, [number, number]>;
  warnings: { field: TargetField; message: string }[];
  adjustments: string[];
}

export interface WeightEntry {
  id: string;
  date: string;
  weight_kg: number;
  body_fat_pct?: number | null;
  notes: string;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  // Torso & Core
  neck_cm?: number | null;
  shoulders_cm?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  // Arms
  arms_cm?: number | null;
  biceps_left_cm?: number | null;
  biceps_right_cm?: number | null;
  forearms_cm?: number | null;
  // Legs
  thighs_cm?: number | null;
  thigh_left_cm?: number | null;
  thigh_right_cm?: number | null;
  calves_cm?: number | null;
  calf_left_cm?: number | null;
  calf_right_cm?: number | null;
  notes: string;
  created_at: string;
}

export interface PersonalRecord {
  id: string;
  exercise: string;
  exercise_name: string;
  primary_muscle: string;
  max_weight_kg: number;
  reps: number;
  estimated_one_rep_max: number;
  achieved_at: string;
}

export interface Gym {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo_url?: string | null;
  branches: { id: string; name: string; address: string; phone: string }[];
  equipment: { id: string; name: string; category: string; quantity: number }[];
  members_count: number;
  created_at: string;
}

export interface GymInvitation {
  id: string;
  gym: string;
  gym_name: string;
  email: string;
  role: 'TRAINER' | 'MEMBER';
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expires_at: string;
  invited_by_name: string;
  created_at: string;
}

export interface TrainerClientAssignment {
  id: string;
  trainer_membership: string;
  client_membership: string;
  trainer_name: string;
  client_name: string;
  client_email: string;
  client_id: string;
  is_active: boolean;
  start_date: string;
  notes: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actor_name: string;
  gym?: string | null;
  gym_name?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  created_at: string;
}

export interface Notification {
  id: string;
  actor?: string | null;
  actor_name: string;
  gym?: string | null;
  gym_name?: string | null;
  verb: string;
  message: string;
  target_type: string;
  target_id: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  streak_days: number;
  workouts_this_week: number;
  workouts_this_month: number;
  weekly_workouts_target?: number;
  total_volume_kg_week: number;
  nutrition: {
    calories_consumed: number;
    calories_target: number;
    protein_consumed: number;
    protein_target: number;
    carbs_consumed: number;
    carbs_target: number;
    fat_consumed: number;
    fat_target: number;
    water_consumed_ml: number;
    water_target_ml: number;
  };
  activity_heatmap: Record<string, number>;
  pending_assigned_workout?: {
    id: string;
    routine_name: string;
    routine_id: string;
    trainer_name: string;
    scheduled_date: string;
  } | null;
  recent_prs: {
    exercise: string;
    max_weight_kg: number;
    reps: number;
    estimated_1rm: number;
    achieved_at: string;
  }[];
  journey?: {
    mode?: JourneyMode;
    mode_label?: string;
    copilot_insight?: string;
    current_weight?: number | null;
    starting_weight?: number | null;
    target_weight?: number | null;
    weight_change?: number | null;
    seven_day_average?: number | null;
    weekly_weight_change?: number | null;
    current_waist?: number | null;
    starting_waist?: number | null;
    waist_change?: number | null;
    cardio_minutes?: number;
    cardio_target?: number;
    weekly_workouts_target?: number;
    program_day?: number | null;
    program_length?: number;
    program_completion_percent?: number;
  };
  daily_log?: {
    steps?: number;
    sleep_hours?: number;
    sleep_quality?: number | null;
    energy_level?: number | null;
    recovery_notes?: string;
    weight_kg?: number | null;
  };
  weekly_review?: any[];
  weekly_health?: WeeklyHealth;
  journey_pacing?: JourneyPacingData;
  adherence?: DashboardAdherence;
}

export type WeeklyHealthStatus = 'good' | 'warn' | 'bad' | 'pending';

export interface WeeklyHealthMetric {
  key: 'workouts' | 'protein' | 'calories' | 'steps' | 'cardio' | 'sleep';
  label: string;
  actual: number | null;
  target: number | null;
  unit: string;
  status: WeeklyHealthStatus;
  status_label: string;
  focus: string;
}

/** Server-computed "this week" summary shared by the Dashboard and Review pages. */
export interface WeeklyHealth {
  window: {
    source: 'program' | 'calendar';
    label: string;
    start: string;
    end: string;
    days_elapsed: number;
    days_in_week: number;
  };
  metrics: WeeklyHealthMetric[];
  focus: string;
}

export interface AdherenceMetricItem {
  label: string;
  actual: number;
  target: number;
  percent: number;
  unit?: string;
  status?: string;
  is_program?: boolean;
  message?: string;
  actual_cups?: number;
  target_cups?: number;
}

export interface DashboardAdherence {
  workout: AdherenceMetricItem;
  weekly_workouts: AdherenceMetricItem;
  calories: AdherenceMetricItem;
  protein: AdherenceMetricItem;
  water: AdherenceMetricItem;
  cardio: AdherenceMetricItem;
  steps?: AdherenceMetricItem;
  sleep?: AdherenceMetricItem;
}


export type JourneyMode = 'CUT' | 'BULK' | 'FOCUS' | 'RECOMP' | 'HABIT';
export type PacingStatus = 'ON_TRACK' | 'PACING_ALERT' | 'OFF_TRACK' | 'NO_PROGRAM';

export interface TrajectoryPoint {
  day: number;
  date: string;
  label: string;
  target_weight: number;
  actual_weight?: number | null;
}

export interface JourneyPacingData {
  has_program: boolean;
  program_id?: string;
  program_name?: string;
  mode: JourneyMode;
  mode_label: string;
  pacing_status: PacingStatus;
  pacing_score: number;
  current_day: number;
  duration_days: number;
  start_date?: string;
  is_calibrating: boolean;
  copilot_insight: string;
  starting_waist?: number | null;
  current_waist?: number | null;
  target_weight?: number | null;
  expected_weight_change?: number | null;
  weekly_workouts_target?: number;
  velocity?: {
    status: string;
    score: number;
    message: string;
    rolling_7_avg: number;
    target_today: number;
    start_weight: number;
    target_weight?: number;
    expected_final_weight: number;
    actual_weekly_rate?: number | null;
    target_weekly_rate?: number | null;
  } | null;
  adherence?: {
    status: string;
    score: number;
    message: string;
    completed_sessions: number;
    scheduled_sessions: number;
    adherence_pct: number;
  } | null;
  strength?: {
    status: string;
    score: number;
    message: string;
    tracked_lifts: Array<{
      exercise: string;
      max_weight_kg: number;
      reps: number;
      estimated_1rm: number;
      achieved_at: string;
      summary?: string;
    }>;
  } | null;
  recovery?: {
    status: string;
    score: number;
    message: string;
    avg_sleep_hours?: number | null;
    target_sleep_hours?: number;
    avg_daily_steps?: number | null;
    target_daily_steps?: number;
    avg_energy?: number | null;
    fatigue_debt_detected?: boolean;
  } | null;
  trajectory_curve: TrajectoryPoint[];
}

export interface DailyLog {
  id: string;
  user: string;
  date: string;
  steps?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  energy_level?: number | null;
  recovery_notes?: string;
  created_at: string;
  updated_at: string;
}


export interface JourneyHistoryEntry {
  id: string;
  name: string;
  mode: JourneyMode;
  mode_label: string;
  start_date: string;
  duration_days: number;
  current_day: number;
  completed_days: number;
  active: boolean;
  archived_at?: string | null;
  start_weight_kg?: number | null;
  target_weight_kg?: number | null;
}

export interface JourneyDayCompletedSession {
  id: string;
  title: string;
  started_at: string;
  completed_at?: string | null;
  duration_seconds: number;
  overall_rpe?: number | null;
  notes: string;
  exercises: WorkoutExercise[];
  total_volume_kg: number;
}

export interface JourneyDay {
  id: string;
  day_number: number;
  label: string;
  is_optional: boolean;
  status: 'UPCOMING' | 'COMPLETED' | 'MISSED';
  routine: string;
  routine_details?: Routine;
  completed_session?: JourneyDayCompletedSession | null;
}

export interface JourneyWeightLogEntry {
  date: string;
  weight_kg: number;
  body_fat_pct?: number | null;
  notes: string;
}

export interface JourneyCardioLogEntry {
  id: string;
  date: string;
  modality: string;
  duration_minutes: number;
  intensity: string;
  heart_rate?: number | null;
  target_zone: string;
  completed: boolean;
}

export interface JourneyDetailProgram {
  id: string;
  name: string;
  mode: JourneyMode;
  mode_label: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  current_day: number;
  active: boolean;
  archived_at?: string | null;
  start_weight_kg?: number | null;
  target_weight_kg?: number | null;
  target_weekly_rate_kg?: number | null;
  target_cardio_minutes_early: number;
  target_cardio_minutes_later: number;
  focus_exercise_name?: string | null;
  target_focus_1rm?: number | null;
  completed_days: number;
  missed_days: number;
}

export interface JourneyMeasurementEntry {
  date: string;
  neck_cm?: number | null;
  shoulders_cm?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  arms_cm?: number | null;
  biceps_left_cm?: number | null;
  biceps_right_cm?: number | null;
  forearms_cm?: number | null;
  thighs_cm?: number | null;
  thigh_left_cm?: number | null;
  thigh_right_cm?: number | null;
  calves_cm?: number | null;
  calf_left_cm?: number | null;
  calf_right_cm?: number | null;
}

export interface JourneyPersonalRecordEntry {
  exercise: string;
  primary_muscle?: string | null;
  max_weight_kg: number;
  reps: number;
  estimated_one_rep_max: number;
  achieved_at: string;
}

export interface JourneyVolumeTrendPoint {
  date: string;
  label: string;
  title: string;
  volume_kg: number;
  duration_min: number;
}

export interface JourneyMuscleBreakdownEntry {
  muscle: string;
  sets: number;
}

export interface JourneyBestSession {
  title: string;
  date: string;
  volume_kg: number;
}

export interface JourneySummary {
  total_workouts: number;
  total_volume_kg: number;
  total_sets: number;
  total_training_minutes: number;
  avg_session_rpe?: number | null;
  best_session?: JourneyBestSession | null;
  muscle_breakdown: JourneyMuscleBreakdownEntry[];
  start_weight_kg?: number | null;
  current_weight_kg?: number | null;
  weight_change_kg?: number | null;
  start_waist_cm?: number | null;
  current_waist_cm?: number | null;
  waist_change_cm?: number | null;
  total_cardio_minutes: number;
  total_cardio_sessions: number;
}

export interface JourneyNutritionSummary {
  days_logged: number;
  days_in_range: number;
  avg_calories: number;
  calories_target: number;
  avg_protein_g: number;
  protein_target_g: number;
}

export interface JourneyDetail {
  program: JourneyDetailProgram;
  pacing: JourneyPacingData;
  summary: JourneySummary;
  personal_records: JourneyPersonalRecordEntry[];
  volume_trend: JourneyVolumeTrendPoint[];
  days: JourneyDay[];
  weight_log: JourneyWeightLogEntry[];
  measurements_log: JourneyMeasurementEntry[];
  cardio_log: JourneyCardioLogEntry[];
  nutrition_summary?: JourneyNutritionSummary | null;
}

export interface StartJourneyPayload {
  mode: JourneyMode;
  duration_days: number;
  start_weight_kg?: number | null;
  target_weight_kg?: number | null;
  name?: string;
  blueprint?: string;
  focus_exercise_id?: string | null;
  target_focus_1rm?: number | null;
}
