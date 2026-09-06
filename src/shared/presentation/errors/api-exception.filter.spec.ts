import { jest } from '@jest/globals';
import { HttpException } from '@nestjs/common';

import {
  ApplicationError,
  RateLimitExceededError,
  ValidationApplicationError,
} from '../../application/errors/application-error';
import { ApiExceptionFilter, toApiError } from './api-exception.filter';

describe('toApiError', () => {
  it('keeps the public contract of an expected application error', () => {
    const error = new ApplicationError({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'O e-mail já está cadastrado.',
      statusCode: 409,
    });

    expect(toApiError(error, 'correlation-1')).toEqual({
      code: 'EMAIL_ALREADY_EXISTS',
      correlationId: 'correlation-1',
      message: 'O e-mail já está cadastrado.',
      statusCode: 409,
    });
  });

  it('includes field errors only for validation failures', () => {
    const error = new ValidationApplicationError([
      {
        code: 'INVALID_VALUE',
        field: 'name',
        message: 'O campo possui um valor inválido.',
      },
    ]);

    expect(toApiError(error, 'correlation-2')).toEqual({
      code: 'VALIDATION_ERROR',
      correlationId: 'correlation-2',
      errors: [
        {
          code: 'INVALID_VALUE',
          field: 'name',
          message: 'O campo possui um valor inválido.',
        },
      ],
      message: 'A requisição contém dados inválidos.',
      statusCode: 400,
    });
  });

  it('hides the details of unexpected and framework exceptions', () => {
    const secret = 'password-or-stack-secret';

    expect(toApiError(new Error(secret), 'correlation-3')).toEqual({
      code: 'INTERNAL_ERROR',
      correlationId: 'correlation-3',
      message: 'Ocorreu um erro interno.',
      statusCode: 500,
    });
    expect(toApiError(new HttpException(secret, 400), 'correlation-4')).toEqual({
      code: 'VALIDATION_ERROR',
      correlationId: 'correlation-4',
      message: 'A requisição é inválida.',
      statusCode: 400,
    });
  });

  it('maps a 404 HttpException to NOT_FOUND with a descriptive message', () => {
    expect(toApiError(new HttpException('Not Found', 404), 'correlation-5')).toEqual({
      code: 'NOT_FOUND',
      correlationId: 'correlation-5',
      message: 'O recurso não foi encontrado.',
      statusCode: 404,
    });
  });

  it('exposes only the integer Retry-After header for rate-limit errors', () => {
    const filter = new ApiExceptionFilter({ generate: () => 'generated-id' });
    const response = {
      json: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const request = { correlationId: 'request-id' };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    filter.catch(new RateLimitExceededError(0.1), host as never);

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '1');
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        correlationId: 'request-id',
        statusCode: 429,
      }),
    );
  });
});
