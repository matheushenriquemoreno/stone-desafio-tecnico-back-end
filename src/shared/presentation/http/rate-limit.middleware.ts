import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import { RateLimitExceededError } from '../../application/errors/application-error';
import {
  REQUEST_LOGGER,
  type RequestLogger,
} from '../../application/ports/request-logger';
import {
  RATE_LIMIT_METRICS,
  RATE_LIMITER,
  type RateLimitMetrics,
  type RateLimitKey,
  type RateLimiter,
} from '../../application/ports/rate-limiter';
import {
  hasExplicitRateLimitPolicy,
  normalizeRouteTemplate,
  resolveRateLimitPolicy,
} from './rate-limit-policies';
import type { CorrelationRequest } from './correlation-id.middleware';
import {
  EFFECTIVE_CLIENT_IP_RESOLVER,
  type EffectiveClientIpResolverPort,
} from './effective-client-ip';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(
    @Inject(EFFECTIVE_CLIENT_IP_RESOLVER)
    private readonly clientIpResolver: EffectiveClientIpResolverPort,
    @Inject(RATE_LIMITER)
    private readonly rateLimiter: RateLimiter,
    @Inject(RATE_LIMIT_METRICS)
    private readonly metrics: RateLimitMetrics,
    @Inject(REQUEST_LOGGER)
    private readonly logger: RequestLogger,
  ) {}

  use(request: CorrelationRequest, _response: Response, next: NextFunction): void {
    if (request.method.toUpperCase() === 'OPTIONS') {
      next();
      return;
    }

    const routeTemplate = normalizeRouteTemplate(
      request.method,
      request.originalUrl || request.path || '/',
    );
    const key: RateLimitKey = {
      ip: this.clientIpResolver.resolve(request),
      method: request.method.toUpperCase(),
      routeTemplate,
    };
    const policy = resolveRateLimitPolicy(key.method, routeTemplate);

    if (!hasExplicitRateLimitPolicy(key.method, routeTemplate)) {
      this.logger.warn({
        correlationId: request.correlationId ?? 'unknown',
        event: 'RATE_LIMIT_FALLBACK_APPLIED',
        level: 'warn',
        limit: policy.limit,
        method: key.method,
        route: 'unconfigured',
        timestamp: new Date().toISOString(),
        windowMs: policy.windowMs,
      });
    }

    const result = this.rateLimiter.consume(key, policy);

    if (!result.allowed) {
      const retryAfterSeconds = result.retryAfterSeconds ?? 1;
      this.metrics.recordExceeded(routeTemplate);
      next(new RateLimitExceededError(retryAfterSeconds));
      return;
    }

    next();
  }
}
