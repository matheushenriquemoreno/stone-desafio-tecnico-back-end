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
const usersTableName = `update_product_${process.pid}_users`;
const productsTableName = `update_product_${process.pid}_products`;
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
    .send({ email, name, password: 'senha-super-secreta' })
    .expect(201);
}

async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(httpServer(app))
    .post('/auth/login')
    .set('Origin', allowedOrigin)
    .send({ email, password: 'senha-super-secreta' });
  const cookie = response.headers['set-cookie']?.[0];

  if (response.status !== 204 || cookie === undefined) {
    throw new Error(`O login E2E não retornou o cookie esperado para ${email}.`);
  }

  return cookie.split(';')[0] ?? cookie;
}

describe('PATCH /products/:id', () => {
  let app: INestApplication;
  let creatorCookie: string;
  let otherAccountCookie: string;
  let productId: string;
  let originalProduct: Record<string, unknown>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = endpoint;
    process.env.AWS_REGION = region;
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = usersTableName;
    process.env.PRODUCTS_TABLE_NAME = productsTableName;
    process.env.JWT_SECRET = 'a-development-secret-with-at-least-32-characters';
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

    await register(app, 'update-creator@example.com', 'Creator');
    await register(app, 'update-reader@example.com', 'Reader');
    creatorCookie = await login(app, 'update-creator@example.com');
    otherAccountCookie = await login(app, 'update-reader@example.com');

    const createResponse = await request(httpServer(app))
      .post('/products')
      .set('Origin', allowedOrigin)
      .set('Cookie', creatorCookie)
      .send({
        description: 'Descrição original',
        imageUrl: 'https://example.com/original.png',
        name: 'Produto original',
        price: 99.9,
      })
      .expect(201);

    productId = createResponse.body.id as string;
    originalProduct = createResponse.body as Record<string, unknown>;
  });

  afterAll(async () => {
    await app.close();
    await deleteTableIfPresent(usersTableName);
    await deleteTableIfPresent(productsTableName);
    client.destroy();
  });

  it('updates only received fields for any authenticated account', async () => {
    const response = await request(httpServer(app))
      .patch(`/products/${productId}`)
      .set('Origin', allowedOrigin)
      .set('Cookie', otherAccountCookie)
      .send({ name: 'Produto atualizado', price: 109.9 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      createdAt: originalProduct.createdAt,
      description: 'Descrição original',
      id: productId,
      imageUrl: 'https://example.com/original.png',
      name: 'Produto atualizado',
      price: 109.9,
      updatedAt: expect.any(String),
    });
    expect(response.body.updatedAt).not.toBe(originalProduct.updatedAt);
  });

  it.each([
    {},
    { description: null },
    { name: 'A' },
    { price: 10.001 },
    { imageUrl: 'ftp://example.com/image.png' },
    { unknown: 'rejected' },
  ])('rejects invalid patches without changing the product', async (patch) => {
    const response = await request(httpServer(app))
      .patch(`/products/${productId}`)
      .set('Origin', allowedOrigin)
      .set('Cookie', creatorCookie)
      .send(patch);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    const current = await request(httpServer(app))
      .get(`/products/${productId}`)
      .set('Cookie', otherAccountCookie)
      .expect(200);
    expect(current.body.name).toBe('Produto atualizado');
    expect(current.body.price).toBe(109.9);
  });

  it('returns PRODUCT_NOT_FOUND when the product does not exist', async () => {
    const response = await request(httpServer(app))
      .patch('/products/missing-product')
      .set('Origin', allowedOrigin)
      .set('Cookie', creatorCookie)
      .send({ name: 'Produto ausente' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('requires the authentication cookie and rejects an unauthorized origin', async () => {
    const withoutCookie = await request(httpServer(app))
      .patch(`/products/${productId}`)
      .set('Origin', allowedOrigin)
      .send({ name: 'Sem cookie' });
    const withoutOrigin = await request(httpServer(app))
      .patch(`/products/${productId}`)
      .set('Origin', 'https://evil.example.com')
      .set('Cookie', creatorCookie)
      .send({ name: 'Origem inválida' });

    expect(withoutCookie.status).toBe(401);
    expect(withoutOrigin.status).toBe(403);
  });

  it('publishes the protected patch contract in OpenAPI', async () => {
    const response = await request(httpServer(app)).get('/docs-json');
    const operation = response.body.paths['/products/{id}'].patch;

    expect(response.status).toBe(200);
    expect(operation.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '400': expect.any(Object),
        '401': expect.any(Object),
        '403': expect.any(Object),
        '404': expect.any(Object),
      }),
    );
    expect(operation.security).toEqual([{ cookie: [] }]);
    expect(response.body.components.schemas.UpdateProductDto).toBeDefined();
  });
});
