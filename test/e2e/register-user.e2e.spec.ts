import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import {
  RATE_LIMITER,
  type RateLimiter,
} from '../../src/shared/application/ports/rate-limiter';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { setupOpenApi } from '../../src/shared/presentation/openapi/setup-openapi';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';

const endpoint = 'http://localhost:8000';
const region = 'us-east-1';
const allowedOrigin = 'https://app.example.com';
const tableName = `register_${process.pid}_users`;
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

function httpServer(
  app: INestApplication,
): ReturnType<INestApplication['getHttpServer']> {
  return app.getHttpServer();
}

describe('POST /auth/register', () => {
  let app: INestApplication;
  let limiter: RateLimiter;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = endpoint;
    process.env.AWS_REGION = region;
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = tableName;
    process.env.PRODUCTS_TABLE_NAME = `register_${process.pid}_products`;
    process.env.JWT_SECRET = 'a-development-secret-with-at-least-32-characters';
    process.env.JWT_ISSUER = 'stone-api';
    process.env.JWT_AUDIENCE = 'stone-web';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = allowedOrigin;
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    await deleteTableIfPresent();
    await createTable();

    const { AppModule } = await import('../../src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    const configService = app.get(ConfigService<AppConfig>);
    app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
    app.useGlobalPipes(new PublicValidationPipe());
    setupOpenApi(app, configService.getOrThrow('cookieName'));
    await app.init();
    limiter = app.get(RATE_LIMITER);
  });

  afterAll(async () => {
    await app.close();
    await deleteTableIfPresent();
    client.destroy();
    documentClient.destroy();
  });

  beforeEach(() => {
    limiter.clear();
  });

  it('returns only public fields, stores a hash and does not authenticate', async () => {
    const plainPassword = 'senha-super-secreta';
    const response = await request(httpServer(app))
      .post('/auth/register')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({
        email: '  MARIA@example.com ',
        name: '  Maria Silva  ',
        password: plainPassword,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      email: 'maria@example.com',
      id: expect.any(String),
      name: 'Maria Silva',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(plainPassword);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const itemOutput = await documentClient.send(
      new GetCommand({
        ConsistentRead: true,
        Key: { email: 'maria@example.com' },
        TableName: tableName,
      }),
    );
    const item = itemOutput.Item as Record<string, unknown> | undefined;

    expect(Object.keys(item ?? {}).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'passwordHash',
    ]);
    expect(item?.passwordHash).toEqual(expect.stringMatching(/^\$argon2id\$/));
    expect(item?.passwordHash).not.toContain(plainPassword);
    expect(item).not.toHaveProperty('password');
  });

  it('returns a stable conflict after e-mail normalization without changing the account', async () => {
    const response = await request(httpServer(app))
      .post('/auth/register')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({
        email: ' MARIA@EXAMPLE.COM ',
        name: 'Another Name',
        password: 'outra-senha-segura',
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
      statusCode: 409,
    });
    expect(JSON.stringify(response.body)).not.toContain('outra-senha-segura');
  });

  it.each([
    {
      body: { email: 'valid@example.com', name: 'A', password: '12345678' },
      field: 'name',
    },
    {
      body: {
        email: 'valid@example.com',
        name: 'A'.repeat(101),
        password: '12345678',
      },
      field: 'name',
    },
    {
      body: { email: 'not-an-email', name: 'Maria', password: '12345678' },
      field: 'email',
    },
    {
      body: { email: 'valid@example.com', name: 'Maria', password: '1234567' },
      field: 'password',
    },
    {
      body: {
        email: 'valid@example.com',
        name: 'Maria',
        password: '1'.repeat(129),
      },
      field: 'password',
    },
    {
      body: {
        email: 'valid@example.com',
        name: 'Maria',
        password: '12345678',
        unknown: 'rejected',
      },
      field: 'unknown',
    },
  ])(
    'returns a public validation error for invalid $field',
    async ({ body, field }) => {
      const response = await request(httpServer(app))
        .post('/auth/register')
        .set('Origin', allowedOrigin)
        .set('X-CSRF-Protection', '1')
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(JSON.stringify(response.body)).not.toContain('rejected');
    },
  );

  it('rejects a registration without CSRF before writing a user', async () => {
    const response = await request(httpServer(app))
      .post('/auth/register')
      .set('Origin', allowedOrigin)
      .send({
        email: 'without-csrf@example.com',
        name: 'Maria',
        password: '12345678',
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'REQUEST_FORBIDDEN',
      statusCode: 403,
    });
    const item = await documentClient.send(
      new GetCommand({
        Key: { email: 'without-csrf@example.com' },
        TableName: tableName,
      }),
    );
    expect(item.Item).toBeUndefined();
  });

  it('rejects a registration from an unlisted origin', async () => {
    const response = await request(httpServer(app))
      .post('/auth/register')
      .set('Origin', 'https://evil.example.com')
      .set('X-CSRF-Protection', '1')
      .send({
        email: 'without-origin@example.com',
        name: 'Maria',
        password: '12345678',
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'REQUEST_FORBIDDEN',
      statusCode: 403,
    });
  });

  it('publishes the register contract in the OpenAPI UI and JSON', async () => {
    const jsonResponse = await request(httpServer(app)).get('/docs-json');
    const uiResponse = await request(httpServer(app)).get('/docs');
    const registerOperation = jsonResponse.body.paths['/auth/register'].post;

    expect(jsonResponse.status).toBe(200);
    expect(uiResponse.status).toBe(200);
    expect(registerOperation.responses).toEqual(
      expect.objectContaining({
        '201': expect.any(Object),
        '400': expect.any(Object),
        '403': expect.any(Object),
        '409': expect.any(Object),
      }),
    );
    expect(registerOperation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: 'header',
          name: 'X-CSRF-Protection',
          required: true,
        }),
      ]),
    );
    expect(jsonResponse.body.components.schemas.RegisterUserDto).toBeDefined();
    expect(jsonResponse.body.components.schemas.RegisterUserResponseDto).toBeDefined();
  });
});
