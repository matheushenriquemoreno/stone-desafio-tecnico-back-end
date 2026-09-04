import { jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

import type {
  RateLimitMetrics,
  RateLimitResult,
  RateLimiter,
} from '../../application/ports/rate-limiter';
import {
  RateLimitMiddleware,
} from './rate-limit.middleware';
import type { EffectiveClientIpResolverPort } from './effective-client-ip';

function requestDouble(method: string, path: string): Request {
  return {
    method,
    originalUrl: path,
    path,
  } as unknown as Request;
}

class RecordingLimiter implements RateLimiter {
  readonly keys: Array<{ ip: string; method: string; routeTemplate: string }> = [];
  result: RateLimitResult = { allowed: true };

  consume(
    key: { ip: string; method: string; routeTemplate: string },
  ): RateLimitResult {
    this.keys.push(key);
    return this.result;
  }

  clear(): void {}

  size(): number {
    return 0;
  }
}

class RecordingMetrics implements RateLimitMetrics {
  readonly routes: string[] = [];

  recordExceeded(routeTemplate: string): void {
    this.routes.push(routeTemplate);
  }

  getExceededCount(): number {
    return this.routes.length;
  }
}

describe('RateLimitMiddleware', () => {
  it('passes OPTIONS without resolving IP or consuming a bucket', () => {
    const resolver = {
      resolve: jest.fn(() => '203.0.113.10'),
    } satisfies EffectiveClientIpResolverPort;
    const limiter = new RecordingLimiter();
    const metrics = new RecordingMetrics();
    const nextMock = jest.fn();
    const next = nextMock as unknown as NextFunction;

    new RateLimitMiddleware(resolver, limiter, metrics).use(
      requestDouble('OPTIONS', '/products'),
      {} as Response,
      next,
    );

    expect(nextMock).toHaveBeenCalledWith();
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(limiter.keys).toHaveLength(0);
  });

  it('uses the normalized template and effective IP before downstream handlers', () => {
    const resolver = {
      resolve: jest.fn(() => '203.0.113.10'),
    } satisfies EffectiveClientIpResolverPort;
    const limiter = new RecordingLimiter();
    const metrics = new RecordingMetrics();
    const nextMock = jest.fn();
    const next = nextMock as unknown as NextFunction;

    new RateLimitMiddleware(resolver, limiter, metrics).use(
      requestDouble('GET', '/products/abc?cursor=opaque'),
      {} as Response,
      next,
    );

    expect(limiter.keys).toEqual([
      {
        ip: '203.0.113.10',
        method: 'GET',
        routeTemplate: '/products/:id',
      },
    ]);
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('stops the pipeline and records only the route template when blocked', () => {
    const resolver = {
      resolve: jest.fn(() => '203.0.113.10'),
    } satisfies EffectiveClientIpResolverPort;
    const limiter = new RecordingLimiter();
    limiter.result = { allowed: false, retryAfterSeconds: 42 };
    const metrics = new RecordingMetrics();
    const nextMock = jest.fn();
    const next = nextMock as unknown as NextFunction;

    new RateLimitMiddleware(resolver, limiter, metrics).use(
      requestDouble('PATCH', '/products/abc'),
      {} as Response,
      next,
    );

    const error = nextMock.mock.calls[0]?.[0] as
      | { name: string; retryAfterSeconds: number }
      | undefined;
    expect(error).toBeDefined();
    if (error === undefined) {
      return;
    }
    expect(error.name).toBe('RateLimitExceededError');
    expect(error.retryAfterSeconds).toBe(42);
    expect(metrics.routes).toEqual(['/products/:id']);
  });
});
