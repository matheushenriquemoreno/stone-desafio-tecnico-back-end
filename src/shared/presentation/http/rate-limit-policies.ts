import type { RateLimitPolicy } from '../../application/ports/rate-limiter';

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  limit: 30,
  windowMs: 60_000,
};

export const RATE_LIMIT_POLICIES: Readonly<Record<string, RateLimitPolicy>> = {
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
};

export function resolveRateLimitPolicy(
  method: string,
  routeTemplate: string,
): RateLimitPolicy {
  return (
    RATE_LIMIT_POLICIES[`${method.toUpperCase()} ${routeTemplate}`] ??
    DEFAULT_RATE_LIMIT_POLICY
  );
}

export function normalizeRouteTemplate(method: string, path: string): string {
  const normalizedPath = path.split('?')[0] ?? '/';

  if (normalizedPath === '/products') {
    return '/products';
  }

  if (/^\/products\/[^/]+$/.test(normalizedPath)) {
    return '/products/:id';
  }

  return normalizedPath;
}
