import { InMemoryRateLimitMetrics } from './in-memory-rate-limit-metrics';

describe('InMemoryRateLimitMetrics', () => {
  it('aggregates blocked responses by route template only', () => {
    const metrics = new InMemoryRateLimitMetrics();

    metrics.recordExceeded('/products/:id');
    metrics.recordExceeded('/products/:id');
    metrics.recordExceeded('/auth/login');

    expect(metrics.getExceededCount('/products/:id')).toBe(2);
    expect(metrics.getExceededCount('/auth/login')).toBe(1);
    expect(metrics.getExceededCount('/products/secret-id')).toBe(0);
  });
});
