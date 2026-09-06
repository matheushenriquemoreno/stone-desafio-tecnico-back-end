export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'REQUEST_FORBIDDEN'
  | 'NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiFieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ApiError {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly correlationId: string;
  readonly errors?: readonly ApiFieldError[];
}
