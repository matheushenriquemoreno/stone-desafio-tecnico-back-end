import { Email } from '../../domain/email';
import type { PasswordHasher } from '../ports/password-hasher';
import type { AccessTokenService } from '../ports/access-token-service';
import type { UserRepository } from '../ports/user-repository';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';

export interface AuthenticateUserInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthenticateUserOutput {
  readonly accessToken: string;
}

export class AuthenticateUser {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly passwordHasher: PasswordHasher,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const email = Email.create(input.email);
    const user = await this.userRepository.findByEmail(email);

    if (user === null) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return {
      accessToken: this.accessTokenService.issue(user.id),
    };
  }
}
