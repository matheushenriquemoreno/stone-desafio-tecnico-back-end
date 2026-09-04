import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CLOCK, type Clock } from '../../shared/application/ports/clock';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../shared/application/ports/id-generator';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  type DocumentClient,
} from '../../shared/infrastructure/dynamodb/dynamodb.tokens';
import type { AppConfig } from '../../shared/infrastructure/configuration';
import { SystemClock } from '../../shared/infrastructure/clock/system-clock';
import { DynamoDbModule } from '../../shared/infrastructure/dynamodb/dynamodb.module';
import { SecureIdGenerator } from '../../shared/infrastructure/identifiers/secure-id-generator';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from './application/ports/password-hasher';
import {
  USER_REPOSITORY,
  type UserRepository,
} from './application/ports/user-repository';
import { RegisterUser } from './application/register-user/register-user';
import { DynamoDbUserRepository } from './infrastructure/persistence/dynamodb-user.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  controllers: [AuthController],
  imports: [ConfigModule, DynamoDbModule],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: SecureIdGenerator },
    {
      inject: [CLOCK, ID_GENERATOR, PASSWORD_HASHER, USER_REPOSITORY],
      provide: RegisterUser,
      useFactory: (
        clock: Clock,
        idGenerator: IdGenerator,
        passwordHasher: PasswordHasher,
        userRepository: UserRepository,
      ): RegisterUser =>
        new RegisterUser(clock, idGenerator, passwordHasher, userRepository),
    },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    {
      inject: [DYNAMODB_DOCUMENT_CLIENT, ConfigService],
      provide: USER_REPOSITORY,
      useFactory: (
        client: DocumentClient,
        configService: ConfigService<AppConfig>,
      ): UserRepository =>
        new DynamoDbUserRepository(client, configService.getOrThrow('usersTableName')),
    },
  ],
})
export class AuthModule {}
