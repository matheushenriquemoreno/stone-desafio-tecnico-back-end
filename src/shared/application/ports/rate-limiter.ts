export const RATE_LIMITER = Symbol('RATE_LIMITER');
export const RATE_LIMIT_METRICS = Symbol('RATE_LIMIT_METRICS');

export interface RateLimitKey {
  readonly ip: string;
  readonly method: string;
  readonly routeTemplate: string;
}

export interface RateLimitPolicy {
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

export interface RateLimiter {
  consume(key: RateLimitKey, policy: RateLimitPolicy): RateLimitResult;
  clear(): void;
  size(): number;
}

export interface RateLimitMetrics {
  recordExceeded(routeTemplate: string): void;
  getExceededCount(routeTemplate: string): number;
}
