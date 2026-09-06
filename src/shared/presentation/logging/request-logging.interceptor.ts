import {
  HttpException,
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs';

import type { ApiErrorCode } from '../../application/errors/api-error';
import { ApplicationError } from '../../application/errors/application-error';
import { CLOCK, type Clock } from '../../application/ports/clock';
import {
  REQUEST_LOGGER,
  type RequestLogEntry,
  type RequestLogger,
  type RequestLogLevel,
} from '../../application/ports/request-logger';
import type { CorrelationRequest } from '../http/correlation-id.middleware';

function routeTemplate(request: CorrelationRequest): string {
  const routePath = request.route?.path;

  if (typeof routePath === 'string') {
    return routePath;
  }

  return 'unknown';
}

function statusCodeFor(exception: unknown, fallbackStatusCode: number): number {
  if (exception === undefined) {
    return fallbackStatusCode;
  }

  if (exception instanceof ApplicationError) {
    return exception.statusCode;
  }

  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return fallbackStatusCode >= 400 ? fallbackStatusCode : 500;
}

function errorCodeFor(exception: unknown): ApiErrorCode {
  if (exception instanceof ApplicationError) {
    return exception.code;
  }

  if (exception instanceof HttpException) {
    if (exception.getStatus() === 400) {
      return 'VALIDATION_ERROR';
    }

    if (exception.getStatus() === 401) {
      return 'UNAUTHORIZED';
    }

    if (exception.getStatus() === 403) {
      return 'REQUEST_FORBIDDEN';
    }
  }

  return 'INTERNAL_ERROR';
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(REQUEST_LOGGER)
    private readonly logger: RequestLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<CorrelationRequest>();
    const response = httpContext.getResponse<{ statusCode: number }>();
    const startedAt = this.clock.now().getTime();

    return next.handle().pipe(
      tap({
        error: (exception: unknown) =>
          this.logRequest(request, response.statusCode, startedAt, 'error', exception),
        next: () => this.logRequest(request, response.statusCode, startedAt, 'info'),
      }),
    );
  }

  private logRequest(
    request: CorrelationRequest,
    responseStatusCode: number,
    startedAt: number,
    level: RequestLogLevel,
    exception?: unknown,
  ): void {
    const finishedAt = this.clock.now().getTime();
    const baseEntry: RequestLogEntry = {
      correlationId: request.correlationId ?? 'unknown',
      durationMs: Math.max(0, finishedAt - startedAt),
      level,
      method: request.method,
      route: routeTemplate(request),
      statusCode: statusCodeFor(exception, responseStatusCode),
      timestamp: new Date(finishedAt).toISOString(),
    };

    const entry =
      exception === undefined
        ? baseEntry
        : { ...baseEntry, errorCode: errorCodeFor(exception) };

    this.logger.log(entry);
  }
}
