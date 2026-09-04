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
  ValidationApplicationError,
} from '../../application/errors/application-error';
import { ID_GENERATOR, type IdGenerator } from '../../application/ports/id-generator';
import {
  CORRELATION_ID_HEADER,
  type CorrelationRequest,
} from '../http/correlation-id.middleware';

function codeForHttpStatus(statusCode: number): ApiErrorCode {
  if (statusCode === 400) {
    return 'VALIDATION_ERROR';
  }

  if (statusCode === 401) {
    return 'UNAUTHORIZED';
  }

  if (statusCode === 403) {
    return 'REQUEST_FORBIDDEN';
  }

  return 'INTERNAL_ERROR';
}

function messageForHttpStatus(statusCode: number): string {
  if (statusCode === 400) {
    return 'A requisição é inválida.';
  }

  if (statusCode === 401) {
    return 'Não autorizado.';
  }

  if (statusCode === 403) {
    return 'Requisição proibida.';
  }

  return 'Ocorreu um erro interno.';
}

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

    return {
      code: codeForHttpStatus(statusCode),
      correlationId,
      message: messageForHttpStatus(statusCode),
      statusCode,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    correlationId,
    message: 'Ocorreu um erro interno.',
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
    response.status(apiError.statusCode).json(apiError);
  }
}
