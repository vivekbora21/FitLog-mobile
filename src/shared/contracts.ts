export interface ApiErrorResponse {
  detail?: string;
  message?: string;
  error?: { code: string; message: string; details?: unknown };
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DateRangeParams {
  date_from?: string;
  date_to?: string;
}

export class ApiContractError extends Error {
  constructor(message: string, public readonly payload: unknown) {
    super(message);
    this.name = 'ApiContractError';
  }
}

export function validateApiPayload<T>(payload: unknown): T {
  if (payload === null || payload === undefined || (typeof payload !== 'object' && !Array.isArray(payload))) {
    throw new ApiContractError('The server returned an invalid response.', payload);
  }
  return payload as T;
}

export function parsePaginatedResponse<T>(payload: unknown): PaginatedResponse<T> {
  const value = validateApiPayload<Partial<PaginatedResponse<T>>>(payload);
  if (!Array.isArray(value.results)) {
    if (Array.isArray(payload)) return { count: payload.length, next: null, previous: null, results: payload as T[] };
    throw new ApiContractError('The server returned an invalid paginated response.', payload);
  }
  return {
    count: typeof value.count === 'number' ? value.count : value.results.length,
    next: typeof value.next === 'string' ? value.next : null,
    previous: typeof value.previous === 'string' ? value.previous : null,
    results: value.results,
  };
}
