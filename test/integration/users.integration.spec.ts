import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

import { Email } from '../../src/modules/auth/domain/email';
import { User } from '../../src/modules/auth/domain/user';
import { EmailAlreadyExistsError } from '../../src/modules/auth/application/errors/email-already-exists.error';
import { DynamoDbUserRepository } from '../../src/modules/auth/infrastructure/persistence/dynamodb-user.repository';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const region = process.env.AWS_REGION ?? 'us-east-1';
const tableName = `integration_${process.pid}_auth_users`;
const client = new DynamoDBClient({
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpoint,
  region,
});
const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    endpoint,
    region,
  }),
);
const repository = new DynamoDbUserRepository(documentClient, tableName);

async function deleteTableIfPresent(): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return;
    }

    throw error;
  }

  await client.send(new DeleteTableCommand({ TableName: tableName }));
}

async function createTable(): Promise<void> {
  await client.send(
    new CreateTableCommand({
      AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      TableName: tableName,
    }),
  );
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
}

function createUser(id: string, email: string): User {
  return User.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    email: Email.create(email),
    id,
    name: 'Maria Silva',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$integration-hash',
  });
}

describe('DynamoDB user repository', () => {
  beforeAll(async () => {
    await deleteTableIfPresent();
    await createTable();
  });

  afterAll(async () => {
    await deleteTableIfPresent();
    client.destroy();
    documentClient.destroy();
  });

  it('persists and reads a normalized user with only the approved attributes', async () => {
    const user = createUser('user-123', '  MARIA@example.com  ');
    await repository.save(user);

    const itemOutput = await documentClient.send(
      new GetCommand({
        ConsistentRead: true,
        Key: { email: 'maria@example.com' },
        TableName: tableName,
      }),
    );

    expect(itemOutput.Item).toEqual({
      createdAt: '2026-09-04T12:00:00.000Z',
      email: 'maria@example.com',
      id: 'user-123',
      name: 'Maria Silva',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$integration-hash',
    });
    expect(itemOutput.Item).not.toHaveProperty('password');

    await expect(
      repository.findByEmail(Email.create('MARIA@example.com')),
    ).resolves.toMatchObject({
      id: 'user-123',
      name: 'Maria Silva',
    });
  });

  it('allows only one concurrent write for the same normalized e-mail', async () => {
    const first = createUser('user-first', '  DUPLICATE@example.com');
    const second = createUser('user-second', 'duplicate@example.com');

    const results = await Promise.allSettled([
      repository.save(first),
      repository.save(second),
    ]);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(EmailAlreadyExistsError);

    const persisted = await repository.findByEmail(
      Email.create('duplicate@example.com'),
    );
    expect([first.id, second.id]).toContain(persisted?.id);
  });
});
