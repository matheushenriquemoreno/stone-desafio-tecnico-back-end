import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../application/ports/clock';
import {
  type RateLimitKey,
  type RateLimitPolicy,
  type RateLimitResult,
  type RateLimiter,
} from '../../application/ports/rate-limiter';

interface Bucket {
  count: number;
  readonly expiresAt: number;
}

function validatePolicy(policy: RateLimitPolicy): void {
  if (
    !Number.isInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isInteger(policy.windowMs) ||
    policy.windowMs < 1
  ) {
    throw new Error('A política de rate limit deve possuir limite e janela positivos.');
  }
}

function serializeKey(key: RateLimitKey): string {
  return JSON.stringify([key.ip, key.method, key.routeTemplate]);
}

@Injectable()
export class InMemoryFixedWindowRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  consume(key: RateLimitKey, policy: RateLimitPolicy): RateLimitResult {
    validatePolicy(policy);

    const now = this.clock.now().getTime();
    this.removeExpiredBuckets(now);
    const serializedKey = serializeKey(key);
    const currentBucket = this.buckets.get(serializedKey);

    if (currentBucket === undefined) {
      this.buckets.set(serializedKey, {
        count: 1,
        expiresAt: now + policy.windowMs,
      });
      return { allowed: true };
    }

    if (currentBucket.count < policy.limit) {
      currentBucket.count += 1;
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((currentBucket.expiresAt - now) / 1000),
      ),
    };
  }

  clear(): void {
    this.buckets.clear();
  }

  size(): number {
    return this.buckets.size;
  }

  private removeExpiredBuckets(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
