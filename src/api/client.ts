import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens, setAccessToken } from '../lib/secureStore';
import { normalizeWorkoutDay } from '../lib/workout';
import { parsePaginatedResponse, validateApiPayload, type DateRangeParams, type ApiErrorResponse } from '@fitlog/shared';
import type {
  User,
  DashboardStats,
  CalendarDayInfo,
  DayStatus,
  TargetsPayload,
  MacroTarget,
  NutritionDayResponse,
  NutritionHistoryResponse,
  CalorieBurnHistoryResponse,
  NutritionHistoryDay,
  JourneyPacingData,
  WorkoutSession,
  WorkoutSet,
  NutritionDay,
  MealEntry,
  Food,
  RecentFood,
  DailyLog,
  UserProfile,
  WeightEntry,
  PersonalRecord,
  BodyMeasurement,
  Exercise,
  MuscleGroup,
  EquipmentType,
  RoutineExercise,
  BlueprintWorkoutExercise,
  JourneyMode,
  CardioEntry,
  CardioEntryPayload,
  Blueprint,
  PlanPreviewPayload,
  PlanRoadmap,
  CreatePlanPayload,
  CreatePlanResponse,
} from '../types';

export type MealType = MealEntry['meal_type'];
export type { CalendarDayInfo, DayStatus };

export interface ProgramDay {
  id: string;
  day_number: number;
  calendar_date: string;
  label: string;
  is_optional: boolean;
  status: 'UPCOMING' | 'COMPLETED' | 'MISSED' | 'REST';
  routine?: string | null;
  completed_session_id?: string | null;
  completed_session_title?: string | null;
  workout_payload?: BlueprintWorkoutExercise[] | null;
  routine_details?: {
    id: string;
    name: string;
    description?: string;
    exercises?: RoutineExercise[];
  } | null;
}

export interface WorkoutPlan {
  program: {
    id: string;
    name: string;
    mode?: JourneyMode;
    mode_label?: string;
    start_date: string;
    current_day: number;
    duration_days: number;
    start_weight_kg?: number | null;
    target_weight_kg?: number | null;
    target_weekly_rate_kg?: number | null;
  } | null;
  days: ProgramDay[];
}

export interface WorkoutDayView {
  id: string;
  day_number: number;
  calendar_date: string;
  label: string;
  status: ProgramDay['status'];
  is_optional: boolean;
  routine?: string | null;
  routine_details?: ProgramDay['routine_details'];
  completed_session_id?: string | null;
  completed_session_title?: string | null;
}

export function resolveDefaultApiUrl(): string {
  // 0. A hosted (https) backend configured via env always wins
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl && configuredUrl.startsWith('https://')) {
    return configuredUrl.replace(/\/$/, '');
  }

  // 1. If running on web browser, always target localhost or browser hostname
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      return `http://${window.location.hostname}:8000/api`;
    }
    return 'http://localhost:8000/api';
  }

  // 2. If running on native (Expo Go / physical phone / emulator)
  // Dynamically resolve the computer's LAN IP from the Expo Metro server URI
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8000/api`;
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('10.0.2.2')) {
    return envUrl.replace(/\/$/, '');
  }

  // Fallback for Android Studio emulator
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://localhost:8000/api';
}

export const DEFAULT_API_URL = resolveDefaultApiUrl();

// User-facing copy for transport failures; the technical detail goes to the dev console.
export const OFFLINE_MESSAGE = "You're offline or the server can't be reached. Check your connection and try again.";
export const TIMEOUT_MESSAGE = 'The server is taking too long to respond. Please try again in a moment.';

export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status === 408);
}

export interface LastPerformance {
  date: string;
  sets: { set_type: WorkoutSet['set_type']; weight_kg: number; reps: number }[];
}

export interface RecentExercise {
  id: string;
  name: string;
  primary_muscle_name: string;
  primary_muscle_slug: string;
  last_date: string;
}

export type WorkoutSessionPayload = {
  title: string;
  routine?: string | null;
  started_at: string;
  duration_seconds: number;
  notes?: string;
  exercises: {
    exercise: string;
    order: number;
    rest_seconds?: number;
    notes?: string;
    sets: (Pick<WorkoutSet, 'set_number' | 'set_type' | 'weight_kg' | 'reps' | 'completed'> & { rpe?: number | null; rir?: number | null })[];
  }[];
};

export class ApiError extends Error {
  status: number;
  data: ApiErrorResponse;

  constructor(message: string, status: number, data: ApiErrorResponse = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function extractErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  if (typeof err === 'string') return err;
  if (err instanceof ApiError) {
    if (isNetworkError(err)) return err.message;
    if (err.status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  }
  if (err.data) {
    if (typeof err.data.detail === 'string') return err.data.detail;
    if (typeof err.data.message === 'string') return err.data.message;
    if (typeof err.data.non_field_errors === 'object' && err.data.non_field_errors[0]) {
      return String(err.data.non_field_errors[0]);
    }
    const firstKey = Object.keys(err.data)[0];
    if (firstKey) {
      const val = err.data[firstKey];
      if (Array.isArray(val) && val[0]) return `${firstKey}: ${val[0]}`;
      if (typeof val === 'string') return `${firstKey}: ${val}`;
    }
  }
  if (err.message) return err.message;
  return 'Failed to communicate with server.';
}

type UnauthorizedHandler = () => void;

// DRF list endpoints may be paginated ({ count, results }) or return a bare array.
function unwrapList<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

type PageResponse<T> = T[] | { results?: T[]; next?: string | null };

class ApiClient {
  private baseUrl: string = DEFAULT_API_URL;
  private unauthorizedHandler: UnauthorizedHandler | null = null;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor() {
    this.baseUrl = resolveDefaultApiUrl();
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  onUnauthorized(handler: UnauthorizedHandler) {
    this.unauthorizedHandler = handler;
  }

  // null tells waiting requests the refresh failed, so they reject instead of hanging.
  private onTokenRefreshed(token: string | null) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string | null) => void) {
    this.refreshSubscribers.push(cb);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, isRetry: boolean = false): Promise<T> {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${formattedEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Version': '1',
      ...(options.headers as Record<string, string>),
    };

    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Set a strict 10-second timeout so requests never load indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (networkError: any) {
      if (__DEV__) console.warn(`[api] ${options.method ?? 'GET'} ${url} failed:`, networkError);
      if (networkError.name === 'AbortError') {
        throw new ApiError(TIMEOUT_MESSAGE, 408, networkError);
      }
      throw new ApiError(OFFLINE_MESSAGE, 0, {});
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 && !isRetry) {
      // Don't refresh on login endpoint itself
      if (endpoint.includes('/auth/login/')) {
        let errData = {};
        try {
          errData = await response.json();
        } catch {}
        throw new ApiError('Invalid email or password.', 401, errData);
      }

      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearTokens();
        if (this.unauthorizedHandler) this.unauthorizedHandler();
        throw new ApiError('Authentication expired. Please log in again.', 401);
      }

      if (this.isRefreshing) {
        // Wait for current refresh to complete
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber(async (newToken) => {
            if (!newToken) {
              return reject(new ApiError('Could not refresh session.', 401));
            }
            try {
              const retryHeaders = {
                ...headers,
                Authorization: `Bearer ${newToken}`,
              };
              const retryRes = await fetch(url, { ...options, headers: retryHeaders });
              if (!retryRes.ok) {
                const errData = await retryRes.json().catch(() => ({}));
                return reject(new ApiError(`API Error: ${retryRes.status}`, retryRes.status, errData));
              }
              resolve((retryRes.status === 204 ? {} : await retryRes.json()) as T);
            } catch (err) {
              reject(err);
            }
          });
        });
      }

      this.isRefreshing = true;

      let refreshResponse: Response;
      try {
        refreshResponse = await fetch(`${this.baseUrl}/auth/refresh/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
      'X-API-Version': '1',
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      } catch (networkError) {
        // Server unreachable: keep the tokens so the session survives until we're back online.
        this.isRefreshing = false;
        this.onTokenRefreshed(null);
        throw new ApiError(OFFLINE_MESSAGE, 0, {});
      }

      try {
        if (refreshResponse.status >= 500) {
          // Backend hiccup, not a verdict on the refresh token.
          this.isRefreshing = false;
          this.onTokenRefreshed(null);
          throw new ApiError(`Server error while refreshing session: ${refreshResponse.status}`, refreshResponse.status);
        }
        if (!refreshResponse.ok) {
          throw new Error('Refresh token invalid');
        }

        const refreshData = await refreshResponse.json();
        const newAccess = refreshData.access;
        await setAccessToken(newAccess);
        if (refreshData.refresh) {
          await saveTokens(newAccess, refreshData.refresh);
        }

        this.onTokenRefreshed(newAccess);
        this.isRefreshing = false;
      } catch (refreshErr) {
        if (refreshErr instanceof ApiError) throw refreshErr;
        this.isRefreshing = false;
        this.onTokenRefreshed(null);
        await clearTokens();
        if (this.unauthorizedHandler) this.unauthorizedHandler();
        throw new ApiError('Session expired. Please log in again.', 401, {});
      }

      // Retry the original request outside the try, so its errors never wipe the session
      return this.request<T>(endpoint, options, true);
    }

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch {}
      const message = extractErrorMessage({ data: errorBody }) || `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, errorBody);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return validateApiPayload<T>(await response.json());
  }

  // Generic HTTP wrappers
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // --- Specific API Endpoints matching Backend ---

  // Auth
  async login(email: string, password: string): Promise<{ access: string; refresh: string }> {
    const data = await this.post<{ access: string; refresh: string }>('/auth/login/', { email: email.trim(), password });
    await saveTokens(data.access, data.refresh);
    return data;
  }

  async register(payload: { email: string; password: string; first_name: string; last_name: string }): Promise<{ user: any; tokens: { access: string; refresh: string } }> {
    const data = await this.post<{ user: any; tokens: { access: string; refresh: string } }>('/auth/register/', {
      ...payload,
      email: payload.email.trim(),
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
    });
    await saveTokens(data.tokens.access, data.tokens.refresh);
    return data;
  }

  async getMe(): Promise<User> {
    return this.get<User>('/auth/me/');
  }

  async logout(): Promise<void> {
    await clearTokens();
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.post('/auth/password-reset/', { email: email.trim() });
  }

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    await this.post('/auth/password-reset/confirm/', { email: email.trim(), code: code.trim(), new_password: newPassword });
  }

  // Permanently deletes the account server-side, then drops local tokens.
  async deleteAccount(password: string): Promise<void> {
    await this.post('/auth/delete-account/', { password });
    await clearTokens();
  }

  // Analytics & Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.get<DashboardStats>('/analytics/dashboard/');
  }

  async getJourneyPacingStatus(): Promise<JourneyPacingData> {
    return this.get<JourneyPacingData>('/analytics/journey-status/');
  }

  async updateCalendarDayStatus(payload: {
    date: string;
    status: 'COMPLETED' | 'REST' | 'SKIPPED' | 'CLEAR';
    notes?: string;
  }): Promise<{ success: boolean; date: string; status: string; notes?: string }> {
    return this.post('/analytics/calendar-day-status/', payload);
  }

  async updateProgramDay(payload: {
    day_number: number;
    status: 'COMPLETED' | 'MISSED' | 'UPCOMING' | 'REST';
  }): Promise<{ success: boolean; day_number: number; status: string; current_day: number }> {
    return this.post('/workouts/sessions/update-program-day/', payload);
  }

  // Overrides which exercise fills a routine slot for one specific program day, without
  // mutating the shared Routine template. Sending the slot's own original exercise id
  // clears the override. Returns the updated ProgramDay (same shape as plan.days[]/today.today).
  async swapExercise(payload: {
    day_number: number;
    routine_exercise_id: string;
    exercise_id: string;
  }): Promise<ProgramDay> {
    return this.post<ProgramDay>('/workouts/sessions/swap-exercise/', payload);
  }

  // Workouts
  async getTodaysWorkout(): Promise<{
    program?: {
      id: string;
      name: string;
      mode: string;
      mode_label: string;
      current_day: number;
      duration_days: number;
      start_date?: string | null;
    } | null;
    today?: {
      id: string;
      day_number: number;
      label: string;
      status: string;
      is_optional: boolean;
      routine?: string;
      routine_details?: {
        id: string;
        name: string;
        exercises?: RoutineExercise[];
      };
    } | null;
  }> {
    return this.get('/workouts/sessions/today/');
  }

  async getWorkoutPlan(): Promise<WorkoutPlan> {
    const data = await this.get<WorkoutPlan>('/workouts/sessions/plan/');
    return { ...data, days: data.days.map((day) => normalizeWorkoutDay(day) as ProgramDay) };
  }

  async getWorkoutDay(dateKey: string): Promise<{ program: WorkoutPlan['program']; today: ProgramDay | null }> {
    return this.get('/workouts/sessions/today/', { date: dateKey });
  }

  // Archives the active journey (history is kept) and schedules a new one starting today.
  async startJourney(payload: {
    mode: JourneyMode;
    duration_days: number;
    name?: string;
    blueprint?: string;
    start_weight_kg?: number;
    target_weight_kg?: number;
  }): Promise<unknown> {
    return this.post('/workouts/sessions/start-journey/', payload);
  }

  // Guided plan builder
  async getBlueprints(): Promise<{ blueprints: Blueprint[] }> {
    return this.get<{ blueprints: Blueprint[] }>('/plans/blueprints/');
  }

  async previewPlan(payload: PlanPreviewPayload): Promise<PlanRoadmap> {
    return this.post<PlanRoadmap>('/plans/preview/', payload);
  }

  async createPlan(payload: CreatePlanPayload): Promise<CreatePlanResponse> {
    return this.post<CreatePlanResponse>('/plans/', payload);
  }

  async getWorkoutSessions(): Promise<WorkoutSession[]> {
    return unwrapList(await this.get('/workouts/sessions/'));
  }

  async getCalorieBurnHistory(days: number = 30): Promise<CalorieBurnHistoryResponse> {
    return this.get<CalorieBurnHistoryResponse>('/workouts/calorie-history/', { days });
  }

  async getRoutines(): Promise<any[]> {
    return unwrapList(await this.get('/workouts/routines/'));
  }

  // Nutrition
  async getNutrition(dateStr: string = 'today'): Promise<NutritionDayResponse> {
    return this.get<NutritionDayResponse>(`/nutrition/${dateStr}/`);
  }

  async getNutritionHistory(days: number = 30, range: DateRangeParams = {}): Promise<NutritionHistoryResponse> {
    return this.get<NutritionHistoryResponse>('/nutrition-history/', { days, ...range });
  }

  async getMacroTargets(): Promise<TargetsPayload> {
    return this.get<TargetsPayload>('/nutrition/macro-targets/');
  }

  async updateMacroTargets(payload: Partial<MacroTarget>): Promise<TargetsPayload> {
    return this.put<TargetsPayload>('/nutrition/macro-targets/', payload);
  }

  // Recalculates calories/macros from the profile (BMR -> TDEE -> goal) and saves them.
  async applyRecommendedTargets(): Promise<MacroTarget> {
    return this.post<MacroTarget>('/nutrition/macro-targets/recommended/');
  }

  async updateWater(dateStr: string, waterMl: number): Promise<NutritionDay> {
    return this.patch<NutritionDay>(`/nutrition/${dateStr}/`, { water_consumed_ml: Math.max(0, waterMl) });
  }

  // Pass `food` + `servings` to have the server compute macros; otherwise send name + calories explicitly.
  async addMeal(meal: {
    meal_type: MealType;
    date: string;
    name?: string;
    food?: string;
    servings?: number;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  }): Promise<MealEntry> {
    return this.post<MealEntry>('/nutrition/meals/', meal);
  }

  // With a food, the server recomputes macros from `servings`; free-text meals send values directly.
  async updateMeal(
    mealId: string,
    patch: Partial<Pick<MealEntry, 'meal_type' | 'name' | 'servings' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>>
  ): Promise<MealEntry> {
    return this.patch<MealEntry>(`/nutrition/meals/${mealId}/`, patch);
  }

  async deleteMeal(mealId: string): Promise<void> {
    await this.delete(`/nutrition/meals/${mealId}/`);
  }

  async searchFoods(search: string = ''): Promise<Food[]> {
    return unwrapList(await this.get('/nutrition/foods/', { search }));
  }

  async getRecentFoods(): Promise<RecentFood[]> {
    return unwrapList(await this.get('/nutrition/recent-foods/'));
  }

  async repeatYesterday(date: string, mealType?: MealType): Promise<{ copied_count: number }> {
    return this.post('/nutrition/repeat-yesterday/', { date, meal_type: mealType });
  }

  // Workouts (write)
  async getWorkoutSessionsPage(page: number, range: DateRangeParams = {}): Promise<{ results: WorkoutSession[]; next: string | null }> {
    const data = await this.get<unknown>('/workouts/sessions/', { page, ...range });
    const parsed = parsePaginatedResponse<WorkoutSession>(data);
    return { results: parsed.results, next: parsed.next };
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession> {
    return this.get<WorkoutSession>(`/workouts/sessions/${id}/`);
  }

  async createWorkoutSession(session: WorkoutSessionPayload): Promise<WorkoutSession> {
    return this.post<WorkoutSession>('/workouts/sessions/', session);
  }

  // Replaces the session's exercises and sets; the server rebuilds affected PRs.
  async updateWorkoutSession(id: string, session: Omit<WorkoutSessionPayload, 'routine'>): Promise<WorkoutSession> {
    return this.put<WorkoutSession>(`/workouts/sessions/${id}/`, session);
  }

  // Partial update from the post-save completion screen (rating/note only).
  // Omitting `exercises` leaves existing sets untouched — see WorkoutSessionSerializer.update,
  // which only replaces exercises/sets when the `exercises` key is present in the body.
  async completeWorkoutSession(id: string, patch: { overall_rpe?: number | null; notes?: string }): Promise<WorkoutSession> {
    return this.patch<WorkoutSession>(`/workouts/sessions/${id}/`, patch);
  }

  async getLastPerformance(exerciseIds: string[], excludeSession?: string): Promise<Record<string, LastPerformance>> {
    if (exerciseIds.length === 0) return {};
    return this.get('/workouts/sessions/last-performance/', {
      exercises: exerciseIds.join(','),
      exclude_session: excludeSession,
    });
  }

  async getRecentExercises(): Promise<RecentExercise[]> {
    return this.get<RecentExercise[]>('/workouts/sessions/recent-exercises/');
  }

  async searchExercises(search: string, muscle?: string): Promise<Exercise[]> {
    return unwrapList(await this.get('/exercises/', { search: search || undefined, muscle }));
  }

  async getMuscleGroups(): Promise<MuscleGroup[]> {
    return unwrapList(await this.get('/muscle-groups/'));
  }

  async getEquipmentTypes(): Promise<EquipmentType[]> {
    return unwrapList(await this.get('/equipment-types/'));
  }

  async createExercise(data: { name: string; primary_muscle: string; equipment: string }): Promise<Exercise> {
    return this.post<Exercise>('/exercises/', data);
  }

  async deleteWorkoutSession(id: string): Promise<void> {
    await this.delete(`/workouts/sessions/${id}/`);
  }

  // Time-based exercises (treadmill, cycling, rowing, etc.) log here instead of as reps/weight sets.
  async createCardioEntry(entry: CardioEntryPayload): Promise<CardioEntry> {
    return this.post<CardioEntry>('/workouts/cardio/', entry);
  }

  async getCardioEntries(): Promise<CardioEntry[]> {
    return unwrapList(await this.get('/workouts/cardio/'));
  }

  async deleteCardioEntry(id: string): Promise<void> {
    await this.delete(`/workouts/cardio/${id}/`);
  }

  // Daily log (steps / sleep / energy) — POST upserts by date on the server.
  async getDailyLog(date: string): Promise<DailyLog | null> {
    const list = unwrapList<DailyLog>(await this.get('/progress/daily/', { date }));
    return list[0] ?? null;
  }

  async saveDailyLog(log: {
    date: string;
    steps?: number | null;
    sleep_hours?: number | null;
    sleep_quality?: number | null;
    energy_level?: number | null;
    recovery_notes?: string;
  }): Promise<DailyLog> {
    return this.post<DailyLog>('/progress/daily/', log);
  }

  // Profile
  async updateMe(payload: {
    first_name?: string;
    last_name?: string;
    profile?: Partial<
      Pick<UserProfile, 'height_cm' | 'weight_kg' | 'activity_level' | 'fitness_goal' | 'sex' | 'date_of_birth'>
    >;
  }): Promise<User> {
    return this.patch<User>('/auth/me/', payload);
  }

  // Follows every page of a DRF list endpoint (default PAGE_SIZE=20) instead of
  // reading page 1 only. The Progress screen derives starting weight, net change,
  // and the chart's "ALL" range from the complete history, so silently dropping
  // entries beyond the first page corrupts those calculations for long histories.
  // Backend response shape is untouched either way (bare array or {results, next}).
  private async getAllPages<T>(endpoint: string, params: Record<string, any> = {}): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    for (;;) {
      const data = await this.get<PageResponse<T>>(endpoint, { ...params, page });
      if (Array.isArray(data)) {
        all.push(...data);
        break;
      }
      all.push(...(data.results ?? []));
      if (!data.next) break;
      page += 1;
    }
    return all;
  }

  // Progress
  async getWeights(params: DateRangeParams & { page?: number } = {}): Promise<WeightEntry[]> {
    return this.getAllPages<WeightEntry>('/progress/weight/', params);
  }

  async logWeight(date: string, weight_kg: number): Promise<WeightEntry> {
    return this.post<WeightEntry>('/progress/weight/', { date, weight_kg, notes: '' });
  }

  async updateWeight(id: string, weight_kg: number): Promise<WeightEntry> {
    return this.patch<WeightEntry>(`/progress/weight/${id}/`, { weight_kg });
  }

  async deleteWeight(id: string): Promise<void> {
    await this.delete(`/progress/weight/${id}/`);
  }

  async getPersonalRecords(): Promise<PersonalRecord[]> {
    return unwrapList(await this.get('/progress/prs/'));
  }

  async logPersonalRecord(data: {
    exercise: string;
    max_weight_kg: number;
    reps: number;
    achieved_at?: string;
  }): Promise<PersonalRecord> {
    return this.post<PersonalRecord>('/progress/prs/', data);
  }

  async deletePersonalRecord(id: string): Promise<void> {
    await this.delete(`/progress/prs/${id}/`);
  }

  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return this.getAllPages<BodyMeasurement>('/progress/measurements/');
  }

  async logBodyMeasurement(data: {
    date: string;
    waist_cm?: number | null;
    chest_cm?: number | null;
    hips_cm?: number | null;
    arms_cm?: number | null;
    thighs_cm?: number | null;
    neck_cm?: number | null;
    shoulders_cm?: number | null;
    notes?: string;
  }): Promise<BodyMeasurement> {
    return this.post<BodyMeasurement>('/progress/measurements/', data);
  }

  async deleteBodyMeasurement(id: string): Promise<void> {
    await this.delete(`/progress/measurements/${id}/`);
  }

  // ─── Progress Photos ────────────────────────────────────────────────────────

  async getProgressPhotosByDate(): Promise<{ date: string; photos: any[] }[]> {
    return this.get<{ date: string; photos: any[] }[]>('/progress/photos/by-date/');
  }

  async uploadProgressPhoto<T = unknown>(form: FormData): Promise<T> {
    const token = await getAccessToken();
    const url = `${this.baseUrl}/progress/photos/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(`Upload failed: ${response.status}`, response.status, data);
    }
    return validateApiPayload<T>(await response.json());
  }

  async deleteProgressPhoto(id: string): Promise<void> {
    await this.delete(`/progress/photos/${id}/`);
  }
}

export const api = new ApiClient();
