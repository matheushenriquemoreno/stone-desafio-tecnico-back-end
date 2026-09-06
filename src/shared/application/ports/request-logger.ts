import type { ApiErrorCode } from '../errors/api-error';

export const REQUEST_LOGGER = Symbol('REQUEST_LOGGER');

export type RequestLogLevel = 'info' | 'error';

export interface RequestLogEntry {
  readonly timestamp: string;
  readonly level: RequestLogLevel;
  readonly correlationId: string;
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly errorCode?: ApiErrorCode;
}

export interface RateLimitFallbackLogEntry {
  readonly timestamp: string;
  readonly level: 'warn';
  readonly event: 'RATE_LIMIT_FALLBACK_APPLIED';
  readonly correlationId: string;
  readonly method: string;
  readonly route: string;
  readonly limit: number;
  readonly windowMs: number;
}

export interface RequestLogger {
  log(entry: RequestLogEntry): void;
  warn(entry: RateLimitFallbackLogEntry): void;
}
