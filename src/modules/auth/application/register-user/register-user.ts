import type { Clock } from '../../../../shared/application/ports/clock';
import type { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { Email } from '../../domain/email';
import { normalizeName, User, validatePassword } from '../../domain/user';
import type { PasswordHasher } from '../ports/password-hasher';
import type { UserRepository } from '../ports/user-repository';

export interface RegisterUserInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

export interface RegisterUserOutput {
  readonly email: string;
  readonly id: string;
  readonly name: string;
}

export class RegisterUser {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly passwordHasher: PasswordHasher,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const name = normalizeName(input.name);
    const email = Email.create(input.email);
    validatePassword(input.password);
    const id = this.idGenerator.generate();
    const createdAt = this.clock.now();
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = User.create({
      createdAt,
      email,
      id,
      name,
      passwordHash,
    });
    await this.userRepository.save(user);

    return user.toPublicData();
  }
}
