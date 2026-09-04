import type { Email } from './email';
import { InvalidUserDataError } from './errors/user-domain.error';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export interface UserProps {
  readonly createdAt: Date;
  readonly email: Email;
  readonly id: string;
  readonly name: string;
  readonly passwordHash: string;
}

export interface PublicUserData {
  readonly email: string;
  readonly id: string;
  readonly name: string;
}

export function normalizeName(input: string): string {
  const normalized = typeof input === 'string' ? input.trim() : '';

  if (normalized.length < MIN_NAME_LENGTH || normalized.length > MAX_NAME_LENGTH) {
    throw new InvalidUserDataError(
      'INVALID_NAME',
      'O nome deve ter entre 2 e 100 caracteres.',
    );
  }

  return normalized;
}

export function validatePassword(input: string): void {
  const passwordLength = typeof input === 'string' ? input.length : 0;

  if (passwordLength < MIN_PASSWORD_LENGTH || passwordLength > MAX_PASSWORD_LENGTH) {
    throw new InvalidUserDataError(
      'INVALID_PASSWORD',
      'A senha deve ter entre 8 e 128 caracteres.',
    );
  }
}

export class User {
  readonly #createdAt: Date;
  readonly #email: Email;
  readonly #id: string;
  readonly #name: string;
  readonly #passwordHash: string;

  private constructor(props: UserProps) {
    this.#createdAt = props.createdAt;
    this.#email = props.email;
    this.#id = props.id;
    this.#name = normalizeName(props.name);
    this.#passwordHash = props.passwordHash;
  }

  static create(props: UserProps): User {
    return new User(props);
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get email(): Email {
    return this.#email;
  }

  get id(): string {
    return this.#id;
  }

  get name(): string {
    return this.#name;
  }

  get passwordHash(): string {
    return this.#passwordHash;
  }

  toPublicData(): PublicUserData {
    return {
      email: this.#email.value,
      id: this.#id,
      name: this.#name,
    };
  }

  toJSON(): PublicUserData {
    return this.toPublicData();
  }
}
