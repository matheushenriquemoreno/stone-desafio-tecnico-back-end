import { Email } from '../../domain/email';
import { User } from '../../domain/user';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import type { AccessTokenIdentity, AccessTokenService } from '../ports/access-token-service';
import type { PasswordHasher } from '../ports/password-hasher';
import type { UserRepository } from '../ports/user-repository';
import { AuthenticateUser, type AuthenticateUserInput } from './authenticate-user';

class RecordingAccessTokenService implements AccessTokenService {
  readonly subjects: string[] = [];

  issue(subject: string): string {
    this.subjects.push(subject);
    return 'issued-access-token';
  }

  verify(): AccessTokenIdentity | null {
    return null;
  }
}

class RecordingPasswordHasher implements PasswordHasher {
  readonly calls: Array<{ password: string; passwordHash: string }> = [];
  matches = true;
  error: Error | undefined;

  async hash(): Promise<string> {
    throw new Error('Hash inesperado durante autenticação.');
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    this.calls.push({ password: plainPassword, passwordHash });

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.matches;
  }
}

class RecordingUserRepository implements UserRepository {
  readonly emails: string[] = [];
  user: User | null = User.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    email: Email.create('maria@example.com'),
    id: 'user-123',
    name: 'Maria Silva',
    passwordHash: '$argon2id$persisted-hash',
  });
  error: Error | undefined;

  async findByEmail(email: Email): Promise<User | null> {
    this.emails.push(email.value);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.user;
  }

  async save(): Promise<void> {
    throw new Error('Persistência inesperada durante autenticação.');
  }
}

function validInput(): AuthenticateUserInput {
  return {
    email: '  MARIA@example.com ',
    password: 'senha-super-secreta',
  };
}

function createUseCase(
  repository: RecordingUserRepository,
  hasher: RecordingPasswordHasher,
  tokenService: RecordingAccessTokenService,
): AuthenticateUser {
  return new AuthenticateUser(tokenService, hasher, repository);
}

describe('AuthenticateUser', () => {
  it('normalizes the e-mail, verifies the password and issues a token for the user', async () => {
    const repository = new RecordingUserRepository();
    const hasher = new RecordingPasswordHasher();
    const tokenService = new RecordingAccessTokenService();
    const useCase = createUseCase(repository, hasher, tokenService);

    await expect(useCase.execute(validInput())).resolves.toEqual({
      accessToken: 'issued-access-token',
    });
    expect(repository.emails).toEqual(['maria@example.com']);
    expect(hasher.calls).toEqual([
      { password: 'senha-super-secreta', passwordHash: '$argon2id$persisted-hash' },
    ]);
    expect(tokenService.subjects).toEqual(['user-123']);
  });

  it.each([
    { description: 'an account that does not exist', user: null },
    { description: 'an incorrect password', user: 'present' },
    { description: 'an invalid persisted hash', user: 'present' },
  ])('returns the same error for $description', async ({ user }) => {
    const repository = new RecordingUserRepository();
    repository.user = user === null ? null : repository.user;
    const hasher = new RecordingPasswordHasher();
    hasher.matches = false;
    const tokenService = new RecordingAccessTokenService();
    const useCase = createUseCase(repository, hasher, tokenService);

    const result = await useCase.execute(validInput()).catch((error: unknown) => error);

    expect(result).toEqual(new InvalidCredentialsError());
    expect(tokenService.subjects).toEqual([]);
  });

  it('propagates repository failures without converting them to credential errors', async () => {
    const repository = new RecordingUserRepository();
    repository.error = new Error('DynamoDB unavailable');
    const hasher = new RecordingPasswordHasher();
    const tokenService = new RecordingAccessTokenService();
    const useCase = createUseCase(repository, hasher, tokenService);

    await expect(useCase.execute(validInput())).rejects.toBe(repository.error);
    expect(hasher.calls).toEqual([]);
    expect(tokenService.subjects).toEqual([]);
  });

  it('propagates password verification failures without issuing a token', async () => {
    const repository = new RecordingUserRepository();
    const hasher = new RecordingPasswordHasher();
    hasher.error = new Error('Hasher unavailable');
    const tokenService = new RecordingAccessTokenService();
    const useCase = createUseCase(repository, hasher, tokenService);

    await expect(useCase.execute(validInput())).rejects.toBe(hasher.error);
    expect(tokenService.subjects).toEqual([]);
  });

  it('does not access dependencies when the e-mail format is invalid', async () => {
    const repository = new RecordingUserRepository();
    const hasher = new RecordingPasswordHasher();
    const tokenService = new RecordingAccessTokenService();
    const useCase = createUseCase(repository, hasher, tokenService);

    await expect(
      useCase.execute({ ...validInput(), email: 'not-an-email' }),
    ).rejects.toBeDefined();
    expect(repository.emails).toEqual([]);
    expect(hasher.calls).toEqual([]);
    expect(tokenService.subjects).toEqual([]);
  });
});
