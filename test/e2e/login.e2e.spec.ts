import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { setupOpenApi } from '../../src/shared/presentation/openapi/setup-openapi';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';

const endpoint = 'http://localhost:8000';
const region = 'us-east-1';
const allowedOrigin = 'https://app.example.com';
const tableName = `login_${process.pid}_users`;
const client = new DynamoDBClient({
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpoint,
  region,
});

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

describe('POST /auth/login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = endpoint;
    process.env.AWS_REGION = region;
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = tableName;
    process.env.PRODUCTS_TABLE_NAME = `login_${process.pid}_products`;
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

    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({
        email: 'maria@example.com',
        name: 'Maria Silva',
        password: 'senha-super-secreta',
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await deleteTableIfPresent();
    client.destroy();
  });

  it('returns 204 with only a secure-scoped cookie and no token in the body', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({ email: ' MARIA@EXAMPLE.COM ', password: 'senha-super-secreta' });

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.headers['set-cookie']).toHaveLength(1);
    expect(response.headers['set-cookie']?.[0]).toEqual(
      expect.stringMatching(
        /^stone_access_token=.+; Max-Age=900; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
      ),
    );
    expect(response.headers['set-cookie']?.[0]).not.toContain('Domain=');
    expect(JSON.stringify(response.body)).not.toContain('eyJ');
  });

  it('returns generic invalid credentials without setting a cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({ email: 'maria@example.com', password: 'senha-incorreta' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
      statusCode: 401,
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('senha-incorreta');
  });

  it('publishes login and cookie authentication in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    const loginOperation = response.body.paths['/auth/login'].post;

    expect(response.status).toBe(200);
    expect(loginOperation.responses).toEqual(
      expect.objectContaining({
        '204': expect.any(Object),
        '400': expect.any(Object),
        '401': expect.any(Object),
        '403': expect.any(Object),
      }),
    );
    expect(response.body.components.securitySchemes).toMatchObject({
      cookie: expect.objectContaining({ type: 'apiKey', in: 'cookie' }),
    });
  });
});
