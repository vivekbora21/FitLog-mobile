import { isNoSupportedSplitResult, type PlanPreviewResult } from '../../types';
import { firstBlockReason } from './messageCopy';

export interface StepGate {
  canAdvance: boolean;
  /** Reason shown beneath a disabled Continue/Start (spec v1.6 section 8:
   * "Every step: a disabled Continue shows the reason beneath it" -- defect
   * #7 from section 1). Null means advancing is allowed. */
  reason: string | null;
}

/** Combines a local "is this screen even fillable yet" reason with the
 * live preview query's state and the engine's own block messages. Local
 * reasons are presence-only (spec section 5: engine rules are the only
 * semantic validation -- "the frontend never blocks on its own rules"). */
export function gateFromQuery(
  localReason: string | null,
  query: { data?: PlanPreviewResult; isLoading: boolean; isFetching: boolean; isError: boolean }
): StepGate {
  if (localReason) return { canAdvance: false, reason: localReason };

  if (query.isError) {
    return { canAdvance: false, reason: "Couldn't check this plan. Check your connection and try again." };
  }
  if (!query.data) {
    return { canAdvance: false, reason: query.isLoading ? 'Checking your plan…' : 'Fill in the details above to continue.' };
  }
  if (isNoSupportedSplitResult(query.data)) {
    return { canAdvance: false, reason: query.data.detail };
  }
  const blockReason = firstBlockReason(query.data.engine.messages);
  if (blockReason) {
    return { canAdvance: false, reason: blockReason };
  }
  return { canAdvance: true, reason: null };
}
