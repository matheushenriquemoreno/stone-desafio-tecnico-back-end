import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { Email } from '../../domain/email';
import { User } from '../../domain/user';
import { EmailAlreadyExistsError } from '../../application/errors/email-already-exists.error';
import type { UserRepository } from '../../application/ports/user-repository';
import type { DocumentClient } from '../../../../shared/infrastructure/dynamodb/dynamodb.tokens';

interface UserItem {
  readonly [key: string]: unknown;
  readonly createdAt: string;
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly passwordHash: string;
}

function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}

function toUserItem(user: User): UserItem {
  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email.value,
    id: user.id,
    name: user.name,
    passwordHash: user.passwordHash,
  };
}

function isUserItem(item: Record<string, unknown>): item is UserItem {
  return (
    typeof item.createdAt === 'string' &&
    typeof item.email === 'string' &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.passwordHash === 'string'
  );
}

function toUser(item: Record<string, unknown>): User {
  if (!isUserItem(item)) {
    throw new Error('O registro de usuário persistido possui formato inválido.');
  }

  const createdAt = new Date(item.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('O registro de usuário persistido possui data inválida.');
  }

  return User.create({
    createdAt,
    email: Email.create(item.email),
    id: item.id,
    name: item.name,
    passwordHash: item.passwordHash,
  });
}

export class DynamoDbUserRepository implements UserRepository {
  constructor(
    private readonly client: DocumentClient,
    private readonly tableName: string,
  ) {}

  async findByEmail(email: Email): Promise<User | null> {
    const output = await this.client.send(
      new GetCommand({
        Key: { email: email.value },
        TableName: this.tableName,
      }),
    );

    if (output.Item === undefined) {
      return null;
    }

    return toUser(output.Item as unknown as Record<string, unknown>);
  }

  async save(user: User): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          ConditionExpression: 'attribute_not_exists(email)',
          Item: toUserItem(user),
          TableName: this.tableName,
        }),
      );
    } catch (error: unknown) {
      if (isConditionalCheckFailed(error)) {
        throw new EmailAlreadyExistsError();
      }

      throw error;
    }
  }
}
