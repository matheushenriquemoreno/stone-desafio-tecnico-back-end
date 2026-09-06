import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { FixedClock } from '../../application/testing/fixed-clock';
import type {
  RequestLogEntry,
  RequestLogger,
} from '../../application/ports/request-logger';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

class CapturingRequestLogger implements RequestLogger {
  readonly entries: RequestLogEntry[] = [];

  log(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }
}

function executionContext(): ExecutionContext {
  const request = {
    correlationId: 'correlation-1',
    method: 'GET',
    route: { path: '/health' },
  };
  const response = { statusCode: 200 };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('RequestLoggingInterceptor', () => {
  it('logs the actual successful HTTP status and route metadata', async () => {
    const logger = new CapturingRequestLogger();
    const interceptor = new RequestLoggingInterceptor(
      new FixedClock(new Date('2026-09-04T12:00:00.000Z')),
      logger,
    );
    const next: CallHandler = { handle: () => of({ status: 'ok' }) };

    await firstValueFrom(interceptor.intercept(executionContext(), next));

    expect(logger.entries).toEqual([
      {
        correlationId: 'correlation-1',
        durationMs: 0,
        level: 'info',
        method: 'GET',
        route: '/health',
        statusCode: 200,
        timestamp: '2026-09-04T12:00:00.000Z',
      },
    ]);
  });
});
