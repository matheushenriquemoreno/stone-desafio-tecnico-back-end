import {
  DEFAULT_RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICIES,
  normalizeRouteTemplate,
  resolveRateLimitPolicy,
} from './rate-limit-policies';

describe('rate limit policies', () => {
  it('keeps one explicit policy for every ADR-004 endpoint', () => {
    expect(RATE_LIMIT_POLICIES).toEqual({
      'GET /docs': { limit: 30, windowMs: 60_000 },
      'GET /docs-json': { limit: 30, windowMs: 60_000 },
      'GET /health': { limit: 120, windowMs: 60_000 },
      'GET /products': { limit: 60, windowMs: 60_000 },
      'GET /products/:id': { limit: 60, windowMs: 60_000 },
      'PATCH /products/:id': { limit: 20, windowMs: 60_000 },
      'POST /auth/login': { limit: 10, windowMs: 900_000 },
      'POST /auth/logout': { limit: 20, windowMs: 60_000 },
      'POST /auth/register': { limit: 5, windowMs: 900_000 },
      'POST /products': { limit: 20, windowMs: 60_000 },
      'DELETE /products/:id': { limit: 10, windowMs: 60_000 },
    });
  });

  it('returns the fallback only for a route without an explicit policy', () => {
    expect(resolveRateLimitPolicy('GET', '/not-configured')).toBe(
      DEFAULT_RATE_LIMIT_POLICY,
    );
    expect(resolveRateLimitPolicy('GET', '/products')).toEqual({
      limit: 60,
      windowMs: 60_000,
    });
  });

  it('normalizes only the product resource identifier to the route template', () => {
    expect(normalizeRouteTemplate('get', '/products/abc?cursor=opaque')).toBe(
      '/products/:id',
    );
    expect(normalizeRouteTemplate('GET', '/products')).toBe('/products');
    expect(normalizeRouteTemplate('GET', '/products/abc/extra')).toBe(
      '/products/abc/extra',
    );
  });
});
