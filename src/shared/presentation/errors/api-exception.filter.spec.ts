import { HttpException } from '@nestjs/common';

import {
  ApplicationError,
  ValidationApplicationError,
} from '../../application/errors/application-error';
import { toApiError } from './api-exception.filter';

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
});
