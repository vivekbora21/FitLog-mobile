import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { kv } from './kv';
import { api, ApiError, type WorkoutSessionPayload, type MealType } from '../api/client';

/**
 * BUG-11: a workout completion, meal log, or weigh-in attempted on bad gym wifi used to
 * fail immediately and be lost unless the user noticed the error and manually retried.
 * This queues those three mutation types locally (persisted before ever reporting
 * "saved"), retries them with bounded backoff when a transient/connectivity failure
 * occurs, and never retries a permanent validation/auth failure forever.
 *
 * Deliberately NOT a generic sync framework: it only covers the three mutation types the
 * audit flagged as the highest-risk silent-loss moments, each handled explicitly.
 */

export type QueuedOperationType = 'workout' | 'meal' | 'weight';

export type QueuedOperationStatus =
  | 'pending' // queued, not yet synced (may have failed transiently and is waiting to retry)
  | 'syncing' // a sync attempt is in flight right now
  | 'failed'; // a permanent (validation/not-retryable) failure — needs user action

export interface WorkoutQueuePayload {
  session: WorkoutSessionPayload & { routine?: string | null; idempotency_key: string };
}

export interface MealQueuePayload {
  meal: {
    meal_type: MealType;
    date: string;
    name?: string;
    food?: string;
    servings?: number;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    idempotency_key: string;
  };
}

export interface WeightQueuePayload {
  date: string;
  weight_kg: number;
}

export type QueuedOperationPayload = WorkoutQueuePayload | MealQueuePayload | WeightQueuePayload;

export interface QueuedOperation {
  id: string;
  type: QueuedOperationType;
  payload: QueuedOperationPayload;
  /** Short, human-readable label for the recovery UI, e.g. "Push Day" or "Breakfast". */
  label: string;
  status: QueuedOperationStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  /** Backoff gate: skip retrying until this time has passed. */
  nextAttemptAt: number;
}

const QUEUE_KEY_PREFIX = 'fitlog_offline_queue_v1';
const MAX_ATTEMPTS = 8;
const BACKOFF_BASE_MS = 5_000; // 5s
const BACKOFF_CAP_MS = 10 * 60_000; // 10 min

let currentUserId: string | null = null;

/** Scopes the queue's storage key to the signed-in user, so switching accounts on a
 * shared device can't leak or replay one user's queued writes into another's data. */
export function setOfflineQueueUser(userId: string | null) {
  currentUserId = userId;
}

function queueKey(): string {
  return currentUserId ? `${QUEUE_KEY_PREFIX}_${currentUserId}` : `${QUEUE_KEY_PREFIX}_anonymous`;
}

function createId(): string {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function loadQueue(): QueuedOperation[] {
  const raw = kv.get(queueKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistQueue(items: QueuedOperation[]): void {
  kv.set(queueKey(), JSON.stringify(items));
}

/** Current queue snapshot, oldest first — for a "sync status" / recovery UI. */
export function getQueueSnapshot(): QueuedOperation[] {
  return loadQueue().sort((a, b) => a.createdAt - b.createdAt);
}

export function getPendingCount(): number {
  return loadQueue().filter((i) => i.status !== 'failed').length;
}

export function getFailedCount(): number {
  return loadQueue().filter((i) => i.status === 'failed').length;
}

/**
 * Persists the operation locally and returns immediately — the caller can safely tell
 * the user "saved, will sync" before any network call is attempted, because the write
 * now survives an app kill regardless of what happens next.
 */
export function enqueueOperation(
  type: QueuedOperationType,
  payload: QueuedOperationPayload,
  label: string
): QueuedOperation {
  const now = Date.now();
  const op: QueuedOperation = {
    id: createId(),
    type,
    payload,
    label,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
  };
  const items = loadQueue();
  items.push(op);
  persistQueue(items);
  // Fire-and-forget: try immediately in case we're actually online (e.g. the original
  // request failed for a reason other than connectivity, like a one-off server hiccup).
  void processQueue();
  return op;
}

function updateOperation(id: string, patch: Partial<QueuedOperation>): void {
  const items = loadQueue();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch, updatedAt: Date.now() };
  persistQueue(items);
}

export function removeOperation(id: string): void {
  persistQueue(loadQueue().filter((i) => i.id !== id));
}

/** Resets a 'failed' item back to pending so the next processQueue() pass retries it —
 * used by a "Retry" action in the recovery UI after the user fixes what was wrong. */
export function retryOperation(id: string): void {
  updateOperation(id, { status: 'pending', attempts: 0, nextAttemptAt: Date.now(), lastError: undefined });
  void processQueue();
}

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** 0 and 408 are this client's own offline/timeout signals; 5xx is a server-side hiccup.
 * Anything else (400/403/404/422…) is the server rejecting the data itself — retrying
 * unchanged input would just fail the same way forever, so those are permanent. */
function isTransientError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.status === 408 || err.status >= 500;
  }
  return true;
}

function backoffDelay(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
}

async function submitOperation(op: QueuedOperation): Promise<void> {
  switch (op.type) {
    case 'workout': {
      const { session } = op.payload as WorkoutQueuePayload;
      await api.createWorkoutSession(session);
      return;
    }
    case 'meal': {
      const { meal } = op.payload as MealQueuePayload;
      await api.addMeal(meal);
      return;
    }
    case 'weight': {
      const { date: dateKey, weight_kg } = op.payload as WeightQueuePayload;
      await api.logWeight(dateKey, weight_kg);
      return;
    }
  }
}

let processing = false;
let authPaused = false;

/** Call after a successful login — a prior 401 pause (expired/invalid session) no longer
 * applies to a freshly-authenticated session. */
export function resumeQueueAfterLogin(): void {
  authPaused = false;
  void processQueue();
}

export async function processQueue(): Promise<void> {
  if (processing || authPaused) return;
  if (!onlineManager.isOnline()) return;
  processing = true;
  try {
    const items = getQueueSnapshot();
    for (const op of items) {
      if (op.status === 'failed') continue; // needs explicit user retry, not auto-retried
      if (op.nextAttemptAt > Date.now()) continue; // backoff window not elapsed yet
      updateOperation(op.id, { status: 'syncing' });
      try {
        await submitOperation(op);
        removeOperation(op.id);
      } catch (err) {
        if (isAuthError(err)) {
          // Session is actually invalid (not just offline) — further attempts would
          // just 401 again. Pause until the next successful login resumes us.
          authPaused = true;
          updateOperation(op.id, { status: 'pending', lastError: 'Signed out — will retry after you sign back in.' });
          break;
        }
        const attempts = op.attempts + 1;
        const message = err instanceof ApiError ? err.message : 'Could not sync this change.';
        if (isTransientError(err) && attempts < MAX_ATTEMPTS) {
          updateOperation(op.id, {
            status: 'pending',
            attempts,
            lastError: message,
            nextAttemptAt: Date.now() + backoffDelay(attempts),
          });
          // Connectivity is almost certainly down for every other queued item too, and
          // order matters for same-type operations — stop this pass rather than racing
          // ahead with later writes while an earlier one is stuck.
          break;
        }
        // Either a permanent (validation) failure, or a transient one that exhausted
        // its retry budget — stop auto-retrying, but don't block the rest of the queue;
        // this item needs a person to look at it (see getFailedCount/getQueueSnapshot).
        updateOperation(op.id, { status: 'failed', attempts, lastError: message });
      }
    }
  } finally {
    processing = false;
  }
}

let wired = false;

/** Call once from the root layout. Triggers a sync pass on reconnect and on app
 * foreground — the two moments a previously-failed queued write is most likely to
 * finally succeed. */
export function wireOfflineQueueTriggers(): void {
  if (wired) return;
  wired = true;
  onlineManager.subscribe((online) => {
    if (online) void processQueue();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void processQueue();
  });
}
