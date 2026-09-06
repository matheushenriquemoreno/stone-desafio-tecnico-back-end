import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import { resolveTableName } from '../../src/shared/infrastructure/dynamodb/table-names';

const endpoint = 'http://localhost:8000';
const region = 'us-east-1';
const prefix = `health_${process.pid}`;
const tableDefinitions = [
  { baseName: 'users', partitionKey: 'email' },
  { baseName: 'products', partitionKey: 'id' },
] as const;
const tableNames = tableDefinitions.map((table) => ({
  name: resolveTableName(table.baseName, prefix),
  partitionKey: table.partitionKey,
}));
const usersTable = tableNames[0]!;
const productsTable = tableNames[1]!;
const client = new DynamoDBClient({
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpoint,
  region,
});

async function deleteTableIfPresent(tableName: string): Promise<void> {
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

async function createTable(tableName: string, partitionKey: string): Promise<void> {
  await client.send(
    new CreateTableCommand({
      AttributeDefinitions: [{ AttributeName: partitionKey, AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: partitionKey, KeyType: 'HASH' }],
      TableName: tableName,
    }),
  );
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
}

describe('GET /health', () => {
  let app: INestApplication | undefined;

  function httpServer(): ReturnType<INestApplication['getHttpServer']> {
    if (app === undefined) {
      throw new Error('A aplicação de teste não foi inicializada.');
    }

    return app.getHttpServer();
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = endpoint;
    process.env.AWS_REGION = region;
    process.env.DYNAMODB_TABLE_PREFIX = prefix;
    process.env.USERS_TABLE_NAME = 'users';
    process.env.PRODUCTS_TABLE_NAME = 'products';
    process.env.JWT_SECRET = 'a-development-secret-with-at-least-32-characters';
    process.env.JWT_ISSUER = 'stone-api';
    process.env.JWT_AUDIENCE = 'stone-web';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    await Promise.all(tableNames.map((table) => deleteTableIfPresent(table.name)));
    await Promise.all(
      tableNames.map((table) => createTable(table.name, table.partitionKey)),
    );

    const { AppModule } = await import('../../src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all(tableNames.map((table) => deleteTableIfPresent(table.name)));
    client.destroy();
  });

  it('returns exactly the ready contract without authentication', async () => {
    const response = await request(httpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('returns a safe 503 when the users table is unavailable', async () => {
    await deleteTableIfPresent(usersTable.name);

    const response = await request(httpServer()).get('/health');
    const serializedResponse = JSON.stringify(response.body);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço temporariamente indisponível.',
      statusCode: 503,
    });
    expect(serializedResponse).not.toContain(prefix);
    expect(serializedResponse).not.toContain('ResourceNotFoundException');

    await createTable(usersTable.name, usersTable.partitionKey);
  });

  it('returns a safe 503 when the products table is unavailable', async () => {
    await deleteTableIfPresent(productsTable.name);

    const response = await request(httpServer()).get('/health');
    const serializedResponse = JSON.stringify(response.body);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Serviço temporariamente indisponível.',
      statusCode: 503,
    });
    expect(serializedResponse).not.toContain(prefix);
    expect(serializedResponse).not.toContain('ResourceNotFoundException');
  });
});
