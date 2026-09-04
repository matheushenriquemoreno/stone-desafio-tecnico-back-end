export const RATE_LIMITER = Symbol('RATE_LIMITER');

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
