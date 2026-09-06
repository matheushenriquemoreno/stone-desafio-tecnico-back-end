import { ApplicationError } from '../../../../shared/application/errors/application-error';

export class EmailAlreadyExistsError extends ApplicationError {
  constructor() {
    super({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'O e-mail já está cadastrado.',
      statusCode: 409,
    });
    this.name = 'EmailAlreadyExistsError';
  }
}
