import { ApplicationError } from '../../../../shared/application/errors/application-error';

export class InvalidProductCursorError extends ApplicationError {
  constructor() {
    super({
      code: 'VALIDATION_ERROR',
      message: 'O cursor informado é inválido.',
      statusCode: 400,
    });
    this.name = 'InvalidProductCursorError';
  }
}
