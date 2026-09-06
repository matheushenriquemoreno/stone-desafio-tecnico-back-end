import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { RateLimitExceededError } from '../../application/errors/application-error';
import {
  RATE_LIMIT_METRICS,
  RATE_LIMITER,
  type RateLimitMetrics,
  type RateLimitKey,
  type RateLimiter,
} from '../../application/ports/rate-limiter';
import {
  normalizeRouteTemplate,
  resolveRateLimitPolicy,
} from './rate-limit-policies';
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
  ) {}

  use(request: Request, _response: Response, next: NextFunction): void {
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
    const result = this.rateLimiter.consume(
      key,
      resolveRateLimitPolicy(key.method, routeTemplate),
    );

    if (!result.allowed) {
      const retryAfterSeconds = result.retryAfterSeconds ?? 1;
      this.metrics.recordExceeded(routeTemplate);
      next(new RateLimitExceededError(retryAfterSeconds));
      return;
    }

    next();
  }
}
