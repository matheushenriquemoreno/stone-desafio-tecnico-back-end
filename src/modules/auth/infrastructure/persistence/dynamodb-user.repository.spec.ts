import { Email } from '../../domain/email';
import { User } from '../../domain/user';
import type { DocumentClient } from '../../../../shared/infrastructure/dynamodb/dynamodb.tokens';
import { EmailAlreadyExistsError } from '../../application/errors/email-already-exists.error';
import { DynamoDbUserRepository } from './dynamodb-user.repository';

interface SentCommand {
  readonly input: unknown;
}

function createFakeClient(handler: (command: SentCommand) => Promise<unknown>): {
  client: DocumentClient;
  commands: SentCommand[];
} {
  const commands: SentCommand[] = [];
  const client = {
    send: async (command: SentCommand): Promise<unknown> => {
      commands.push(command);
      return handler(command);
    },
  } as unknown as DocumentClient;

  return { client, commands };
}

function createUser(): User {
  return User.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    email: Email.create('maria@example.com'),
    id: 'user-123',
    name: 'Maria Silva',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
  });
}

describe('DynamoDbUserRepository', () => {
  it('writes only the approved user attributes with atomic uniqueness', async () => {
    const fake = createFakeClient(async () => ({}));
    const repository = new DynamoDbUserRepository(fake.client, 'users');

    await repository.save(createUser());

    const command = fake.commands[0];
    expect(command?.input).toEqual({
      ConditionExpression: 'attribute_not_exists(email)',
      Item: {
        createdAt: '2026-09-04T12:00:00.000Z',
        email: 'maria@example.com',
        id: 'user-123',
        name: 'Maria Silva',
        passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
      },
      TableName: 'users',
    });
    expect(
      (command?.input as { Item?: Record<string, unknown> }).Item,
    ).not.toHaveProperty('password');
  });

  it('maps only a conditional conflict to EmailAlreadyExistsError', async () => {
    const conditionalFailure = Object.assign(new Error('condition failed'), {
      name: 'ConditionalCheckFailedException',
    });
    const fake = createFakeClient(async () => {
      throw conditionalFailure;
    });
    const repository = new DynamoDbUserRepository(fake.client, 'users');

    await expect(repository.save(createUser())).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('rethrows technical failures instead of treating them as duplicates', async () => {
    const technicalFailure = new Error('DynamoDB unavailable');
    const fake = createFakeClient(async () => {
      throw technicalFailure;
    });
    const repository = new DynamoDbUserRepository(fake.client, 'users');

    await expect(repository.save(createUser())).rejects.toBe(technicalFailure);
  });

  it('maps an existing item to the domain user and returns null when absent', async () => {
    let callCount = 0;
    const fake = createFakeClient(async () => {
      callCount += 1;

      if (callCount === 1) {
        return {
          Item: {
            createdAt: '2026-09-04T12:00:00.000Z',
            email: 'maria@example.com',
            id: 'user-123',
            name: 'Maria Silva',
            passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
          },
        };
      }

      return {};
    });
    const repository = new DynamoDbUserRepository(fake.client, 'users');

    await expect(
      repository.findByEmail(Email.create('MARIA@example.com')),
    ).resolves.toMatchObject({
      id: 'user-123',
      name: 'Maria Silva',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
    });
    await expect(
      repository.findByEmail(Email.create('nobody@example.com')),
    ).resolves.toBeNull();
  });
});
