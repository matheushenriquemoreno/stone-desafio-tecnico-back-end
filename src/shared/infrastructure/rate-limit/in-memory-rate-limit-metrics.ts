import { Injectable } from '@nestjs/common';

import type { RateLimitMetrics } from '../../application/ports/rate-limiter';

@Injectable()
export class InMemoryRateLimitMetrics implements RateLimitMetrics {
  private readonly exceededByRoute = new Map<string, number>();

  recordExceeded(routeTemplate: string): void {
    this.exceededByRoute.set(
      routeTemplate,
      (this.exceededByRoute.get(routeTemplate) ?? 0) + 1,
    );
  }

  getExceededCount(routeTemplate: string): number {
    return this.exceededByRoute.get(routeTemplate) ?? 0;
  }
}
