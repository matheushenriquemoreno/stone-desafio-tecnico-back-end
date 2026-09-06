export type UserDomainErrorCode = 'INVALID_EMAIL' | 'INVALID_NAME' | 'INVALID_PASSWORD';

export class InvalidUserDataError extends Error {
  readonly code: UserDomainErrorCode;

  constructor(code: UserDomainErrorCode, message: string) {
    super(message);
    this.name = 'InvalidUserDataError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
