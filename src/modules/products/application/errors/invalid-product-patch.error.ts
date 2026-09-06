import { ApplicationError } from '../../../../shared/application/errors/application-error';

export class InvalidProductPatchError extends ApplicationError {
  constructor() {
    super({
      code: 'VALIDATION_ERROR',
      message: 'O patch do produto é inválido.',
      statusCode: 400,
    });
    this.name = 'InvalidProductPatchError';
  }
}
