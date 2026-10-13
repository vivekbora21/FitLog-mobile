/** A locally-unique token for idempotency keys — doesn't need to be cryptographically
 * unique, only unique enough per-user to disambiguate a retried write from a new one. */
export const createIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
