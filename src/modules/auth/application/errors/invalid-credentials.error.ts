import { ApplicationError } from '../../../../shared/application/errors/application-error';

export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
      statusCode: 401,
    });
    this.name = 'InvalidCredentialsError';
  }
}
