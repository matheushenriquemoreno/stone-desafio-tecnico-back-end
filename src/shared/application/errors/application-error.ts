import type { ApiErrorCode, ApiFieldError } from './api-error';

export interface ApplicationErrorOptions {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly message: string;
}

export class ApplicationError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor(options: ApplicationErrorOptions) {
    super(options.message);
    this.name = 'ApplicationError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationApplicationError extends ApplicationError {
  readonly errors: readonly ApiFieldError[];

  constructor(errors: readonly ApiFieldError[]) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'A requisição contém dados inválidos.',
      statusCode: 400,
    });
    this.name = 'ValidationApplicationError';
    this.errors = errors;
  }
}

export class ServiceUnavailableError extends ApplicationError {
  constructor() {
    super({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço temporariamente indisponível.',
      statusCode: 503,
    });
    this.name = 'ServiceUnavailableError';
  }
}
