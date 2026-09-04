import type { Clock } from '../../application/ports/clock';
import { InMemoryFixedWindowRateLimiter } from './in-memory-fixed-window-rate-limiter';

class MutableClock implements Clock {
  private instantMilliseconds: number;

  constructor(instant: string) {
    this.instantMilliseconds = new Date(instant).getTime();
  }

  now(): Date {
    return new Date(this.instantMilliseconds);
  }

  advance(milliseconds: number): void {
    this.instantMilliseconds += milliseconds;
  }
}

const policy = { limit: 2, windowMs: 10_000 } as const;
const key = {
  ip: '203.0.113.10',
  method: 'GET',
  routeTemplate: '/products/:id',
} as const;

describe('InMemoryFixedWindowRateLimiter', () => {
  it('accepts exactly the configured limit and blocks the next request', () => {
    const clock = new MutableClock('2026-09-04T00:00:00.000Z');
    const limiter = new InMemoryFixedWindowRateLimiter(clock);

    expect(limiter.consume(key, policy)).toEqual({ allowed: true });
    expect(limiter.consume(key, policy)).toEqual({ allowed: true });
    expect(limiter.consume(key, policy)).toEqual({
      allowed: false,
      retryAfterSeconds: 10,
    });
  });

  it('does not extend the window when an accepted request arrives later', () => {
    const clock = new MutableClock('2026-09-04T00:00:00.000Z');
    const limiter = new InMemoryFixedWindowRateLimiter(clock);

    limiter.consume(key, policy);
    clock.advance(1_000);
    limiter.consume(key, policy);
    clock.advance(1_000);

    expect(limiter.consume(key, policy)).toEqual({
      allowed: false,
      retryAfterSeconds: 8,
    });
    clock.advance(8_000);
    expect(limiter.consume(key, policy)).toEqual({ allowed: true });
  });

  it('keeps IP, method and route template buckets independent', () => {
    const clock = new MutableClock('2026-09-04T00:00:00.000Z');
    const limiter = new InMemoryFixedWindowRateLimiter(clock);
    const otherIp = { ...key, ip: '203.0.113.11' };
    const otherMethod = { ...key, method: 'PATCH' };
    const otherRoute = { ...key, routeTemplate: '/products' };

    limiter.consume(key, policy);
    limiter.consume(key, policy);

    expect(limiter.consume(otherIp, policy).allowed).toBe(true);
    expect(limiter.consume(otherMethod, policy).allowed).toBe(true);
    expect(limiter.consume(otherRoute, policy).allowed).toBe(true);
    expect(limiter.size()).toBe(4);
  });

  it('shares the bucket for concrete IDs when the route template is equal', () => {
    const clock = new MutableClock('2026-09-04T00:00:00.000Z');
    const limiter = new InMemoryFixedWindowRateLimiter(clock);

    limiter.consume({ ...key, routeTemplate: '/products/:id' }, policy);
    limiter.consume({ ...key, routeTemplate: '/products/:id' }, policy);

    expect(
      limiter.consume({ ...key, routeTemplate: '/products/:id' }, policy),
    ).toEqual({
      allowed: false,
      retryAfterSeconds: 10,
    });
  });

  it('removes expired buckets before accepting a new window', () => {
    const clock = new MutableClock('2026-09-04T00:00:00.000Z');
    const limiter = new InMemoryFixedWindowRateLimiter(clock);

    limiter.consume(key, policy);
    expect(limiter.size()).toBe(1);
    clock.advance(10_000);

    expect(limiter.consume({ ...key, ip: '203.0.113.11' }, policy)).toEqual({
      allowed: true,
    });
    expect(limiter.size()).toBe(1);
    expect(limiter.consume(key, policy)).toEqual({ allowed: true });
    expect(limiter.size()).toBe(2);
  });

  it('rejects an invalid internal policy instead of creating an ambiguous bucket', () => {
    const clock = new MutableClock('2026-09-04T00:00:00.000Z');
    const limiter = new InMemoryFixedWindowRateLimiter(clock);

    expect(() => limiter.consume(key, { limit: 0, windowMs: 1_000 })).toThrow(
      'limite e janela positivos',
    );
    expect(limiter.size()).toBe(0);
  });
});
