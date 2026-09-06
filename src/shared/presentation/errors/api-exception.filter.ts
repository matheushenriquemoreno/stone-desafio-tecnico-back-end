import {
  Catch,
  HttpException,
  Inject,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import type { ApiError, ApiErrorCode } from '../../application/errors/api-error';
import {
  ApplicationError,
  RateLimitExceededError,
  ValidationApplicationError,
} from '../../application/errors/application-error';
import { ID_GENERATOR, type IdGenerator } from '../../application/ports/id-generator';
import {
  CORRELATION_ID_HEADER,
  type CorrelationRequest,
} from '../http/correlation-id.middleware';

const HTTP_STATUS_TO_API_ERROR: Record<number, { code: ApiErrorCode; message: string }> = {
  400: { code: 'VALIDATION_ERROR', message: 'A requisição é inválida.' },
  401: { code: 'UNAUTHORIZED', message: 'Não autorizado.' },
  403: { code: 'REQUEST_FORBIDDEN', message: 'Requisição proibida.' },
  404: { code: 'NOT_FOUND', message: 'O recurso não foi encontrado.' },
};

const DEFAULT_HTTP_ERROR = {
  code: 'INTERNAL_ERROR' as const,
  message: 'Ocorreu um erro interno.',
};

export function toApiError(exception: unknown, correlationId: string): ApiError {
  if (exception instanceof ValidationApplicationError) {
    return {
      code: exception.code,
      correlationId,
      errors: exception.errors,
      message: exception.message,
      statusCode: exception.statusCode,
    };
  }

  if (exception instanceof ApplicationError) {
    return {
      code: exception.code,
      correlationId,
      message: exception.message,
      statusCode: exception.statusCode,
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const mapped = HTTP_STATUS_TO_API_ERROR[statusCode] ?? DEFAULT_HTTP_ERROR;

    return {
      code: mapped.code,
      correlationId,
      message: mapped.message,
      statusCode,
    };
  }

  return {
    code: DEFAULT_HTTP_ERROR.code,
    correlationId,
    message: DEFAULT_HTTP_ERROR.message,
    statusCode: 500,
  };
}

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<CorrelationRequest>();
    const response = httpContext.getResponse<Response>();
    const correlationId = request.correlationId ?? this.idGenerator.generate();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    const apiError = toApiError(exception, correlationId);
    if (exception instanceof RateLimitExceededError) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    response.status(apiError.statusCode).json(apiError);
  }
}
