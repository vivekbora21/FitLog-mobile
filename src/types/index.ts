// Re-export all domain models, contracts, and utilities from the shared package
export * from '../../../packages/shared/src';

// Mobile-specific navigation & UI types
export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ApiErrorResponse {
  detail?: string;
  message?: string;
  [key: string]: any;
}
