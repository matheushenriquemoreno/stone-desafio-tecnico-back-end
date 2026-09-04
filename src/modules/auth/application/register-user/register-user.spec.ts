import { FixedClock } from '../../../../shared/application/testing/fixed-clock';
import { FixedIdGenerator } from '../../../../shared/application/testing/fixed-id-generator';
import type { PasswordHasher } from '../ports/password-hasher';
import type { UserRepository } from '../ports/user-repository';
import type { User } from '../../domain/user';
import { RegisterUser, type RegisterUserInput } from './register-user';

class RecordingPasswordHasher implements PasswordHasher {
  readonly calls: string[] = [];
  readonly hashes = new Map<string, string>();

  constructor(private readonly events: string[]) {}

  async hash(plainPassword: string): Promise<string> {
    this.events.push('hash');
    this.calls.push(`hash:${plainPassword}`);
    const passwordHash = `$argon2id$test$${plainPassword}`;
    this.hashes.set(plainPassword, passwordHash);
    return passwordHash;
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    return this.hashes.get(plainPassword) === passwordHash;
  }
}

class RecordingUserRepository implements UserRepository {
  readonly calls: string[] = [];
  savedUser: User | undefined;
  error: Error | undefined;

  constructor(private readonly events: string[]) {}

  async findByEmail(): Promise<User | null> {
    return null;
  }

  async save(user: User): Promise<void> {
    this.events.push('save');
    this.calls.push('save');
    if (this.error !== undefined) {
      throw this.error;
    }

    this.savedUser = user;
  }
}

function validInput(): RegisterUserInput {
  return {
    email: '  MARIA@example.com ',
    name: '  Maria Silva  ',
    password: 'senha-super-secreta',
  };
}

function createUseCase(
  repository: RecordingUserRepository,
  hasher: RecordingPasswordHasher,
): RegisterUser {
  return new RegisterUser(
    new FixedClock(new Date('2026-09-04T12:00:00.000Z')),
    new FixedIdGenerator(['user-123']),
    hasher,
    repository,
  );
}

describe('RegisterUser', () => {
  it('normalizes, hashes, persists once and returns only public data', async () => {
    const events: string[] = [];
    const repository = new RecordingUserRepository(events);
    const hasher = new RecordingPasswordHasher(events);
    const useCase = createUseCase(repository, hasher);

    await expect(useCase.execute(validInput())).resolves.toEqual({
      email: 'maria@example.com',
      id: 'user-123',
      name: 'Maria Silva',
    });
    expect(hasher.calls).toEqual(['hash:senha-super-secreta']);
    expect(repository.calls).toEqual(['save']);
    expect(events).toEqual(['hash', 'save']);
    expect(repository.savedUser).toMatchObject({
      email: { value: 'maria@example.com' },
      id: 'user-123',
      name: 'Maria Silva',
      passwordHash: '$argon2id$test$senha-super-secreta',
    });
  });

  it.each([
    { ...validInput(), name: 'A' },
    { ...validInput(), email: 'not-an-email' },
    { ...validInput(), password: 'short' },
  ])('does not hash or persist invalid input: %j', async (input) => {
    const events: string[] = [];
    const repository = new RecordingUserRepository(events);
    const hasher = new RecordingPasswordHasher(events);
    const useCase = createUseCase(repository, hasher);

    await expect(useCase.execute(input)).rejects.toBeDefined();
    expect(events).toEqual([]);
    expect(hasher.calls).toEqual([]);
    expect(repository.calls).toEqual([]);
  });

  it('propagates a duplicate e-mail without creating authentication', async () => {
    const events: string[] = [];
    const repository = new RecordingUserRepository(events);
    repository.error = new Error('EMAIL_ALREADY_EXISTS');
    const hasher = new RecordingPasswordHasher(events);
    const useCase = createUseCase(repository, hasher);

    await expect(useCase.execute(validInput())).rejects.toBe(repository.error);
    expect(repository.calls).toEqual(['save']);
  });

  it('propagates technical persistence failures', async () => {
    const events: string[] = [];
    const repository = new RecordingUserRepository(events);
    repository.error = new Error('DynamoDB unavailable');
    const hasher = new RecordingPasswordHasher(events);
    const useCase = createUseCase(repository, hasher);

    await expect(useCase.execute(validInput())).rejects.toBe(repository.error);
  });
});
