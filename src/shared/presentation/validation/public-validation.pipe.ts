import { ValidationPipe, type ValidationError } from '@nestjs/common';

import type { ApiFieldError } from '../../application/errors/api-error';
import { ValidationApplicationError } from '../../application/errors/application-error';

function mapConstraintCode(constraint: string): string {
  if (constraint === 'isNotEmpty') {
    return 'REQUIRED_FIELD';
  }

  if (constraint === 'whitelistValidation') {
    return 'UNKNOWN_FIELD';
  }

  return 'INVALID_VALUE';
}

function mapValidationErrors(
  validationErrors: readonly ValidationError[],
  parentField = '',
): ApiFieldError[] {
  return validationErrors.flatMap((validationError) => {
    const field = parentField
      ? `${parentField}.${validationError.property}`
      : validationError.property;
    const constraints = Object.keys(validationError.constraints ?? {});
    const currentErrors = constraints.map((constraint) => ({
      code: mapConstraintCode(constraint),
      field,
      message:
        constraint === 'isNotEmpty'
          ? 'O campo é obrigatório.'
          : 'O campo possui um valor inválido.',
    }));

    return [
      ...currentErrors,
      ...mapValidationErrors(validationError.children ?? [], field),
    ];
  });
}

export class PublicValidationPipe extends ValidationPipe {
  constructor() {
    super({
      exceptionFactory: (validationErrors: ValidationError[]) =>
        new ValidationApplicationError(mapValidationErrors(validationErrors)),
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
      whitelist: true,
    });
  }
}
