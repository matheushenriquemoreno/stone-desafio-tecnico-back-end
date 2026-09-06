import { InvalidUserDataError } from './errors/user-domain.error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string): Email {
    const normalized = typeof input === 'string' ? input.trim().toLowerCase() : '';

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new InvalidUserDataError(
        'INVALID_EMAIL',
        'O e-mail informado possui formato inválido.',
      );
    }

    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }
}
