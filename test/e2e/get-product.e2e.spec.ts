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
import jwt from 'jsonwebtoken';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { setupOpenApi } from '../../src/shared/presentation/openapi/setup-openapi';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';

const endpoint = 'http://localhost:8000';
const region = 'us-east-1';
const allowedOrigin = 'https://app.example.com';
const secret = 'a-development-secret-with-at-least-32-characters';
const usersTableName = `get_product_${process.pid}_users`;
const productsTableName = `get_product_${process.pid}_products`;
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

function httpServer(
  app: INestApplication,
): ReturnType<INestApplication['getHttpServer']> {
  return app.getHttpServer();
}

async function register(app: INestApplication, email: string, name: string): Promise<void> {
  await request(httpServer(app))
    .post('/auth/register')
    .set('Origin', allowedOrigin)
    .set('X-CSRF-Protection', '1')
    .send({ email, name, password: 'senha-super-secreta' })
    .expect(201);
}

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(httpServer(app))
    .post('/auth/login')
    .set('Origin', allowedOrigin)
    .set('X-CSRF-Protection', '1')
    .send({ email, password: 'senha-super-secreta' });
  const cookie = response.headers['set-cookie']?.[0];

  if (response.status !== 204 || cookie === undefined) {
    throw new Error(`O login E2E não retornou o cookie esperado para ${email}.`);
  }

  return cookie.split(';')[0] ?? cookie;
}

function expiredCookie(): string {
  const token = jwt.sign(
    { sub: 'user-123' },
    secret,
    { algorithm: 'HS256', audience: 'stone-web', expiresIn: -1, issuer: 'stone-api' },
  );

  return `stone_access_token=${token}`;
}

describe('GET /products/:id', () => {
  let app: INestApplication;
  let creatorCookie: string;
  let otherAccountCookie: string;
  let productId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = endpoint;
    process.env.AWS_REGION = region;
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = usersTableName;
    process.env.PRODUCTS_TABLE_NAME = productsTableName;
    process.env.JWT_SECRET = secret;
    process.env.JWT_ISSUER = 'stone-api';
    process.env.JWT_AUDIENCE = 'stone-web';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = allowedOrigin;
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    await deleteTableIfPresent(usersTableName);
    await deleteTableIfPresent(productsTableName);
    await createTable(usersTableName, 'email');
    await createTable(productsTableName, 'id');

    const { AppModule } = await import('../../src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    const configService = app.get(ConfigService<AppConfig>);
    app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
    app.useGlobalPipes(new PublicValidationPipe());
    setupOpenApi(app, configService.getOrThrow('cookieName'));
    await app.init();

    await register(app, 'creator@example.com', 'Creator');
    await register(app, 'reader@example.com', 'Reader');
    creatorCookie = await login(app, 'creator@example.com');
    otherAccountCookie = await login(app, 'reader@example.com');

    const createResponse = await request(httpServer(app))
      .post('/products')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', creatorCookie)
      .send({
        description: 'Produto compartilhado',
        imageUrl: 'https://example.com/shared-product.png',
        name: 'Produto compartilhado',
        price: 49.9,
      });

    if (createResponse.status !== 201 || typeof createResponse.body.id !== 'string') {
      throw new Error('A preparação E2E não criou o produto compartilhado.');
    }

    productId = createResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
    await deleteTableIfPresent(usersTableName);
    await deleteTableIfPresent(productsTableName);
    client.destroy();
  });

  it('allows another authenticated account to read the complete shared product', async () => {
    const response = await request(httpServer(app))
      .get(`/products/${productId}`)
      .set('Cookie', otherAccountCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      description: 'Produto compartilhado',
      id: productId,
      imageUrl: 'https://example.com/shared-product.png',
      name: 'Produto compartilhado',
      price: 49.9,
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });
    expect(response.body.createdAt).toBe(response.body.updatedAt);
  });

  it('returns PRODUCT_NOT_FOUND for an absent identifier', async () => {
    const response = await request(httpServer(app))
      .get('/products/missing-product')
      .set('Cookie', otherAccountCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Produto não encontrado.',
      statusCode: 404,
    });
  });

  it.each([
    { description: 'no cookie', cookie: undefined },
    { description: 'an invalid cookie', cookie: 'stone_access_token=invalid-token' },
    { description: 'an expired cookie', cookie: expiredCookie() },
  ])('returns generic unauthorized for $description', async ({ cookie }) => {
    const getRequest = request(httpServer(app)).get(`/products/${productId}`);

    if (cookie !== undefined) {
      getRequest.set('Cookie', cookie);
    }

    const response = await getRequest;

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(JSON.stringify(response.body)).not.toContain('eyJ');
  });

  it('publishes the protected query contract in OpenAPI', async () => {
    const response = await request(httpServer(app)).get('/docs-json');
    const operation = response.body.paths['/products/{id}'].get;

    expect(response.status).toBe(200);
    expect(operation.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '401': expect.any(Object),
        '404': expect.any(Object),
      }),
    );
    expect(operation.security).toEqual([{ cookie: [] }]);
  });
});
