import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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
const usersTableName = `create_product_${process.pid}_users`;
const productsTableName = `create_product_${process.pid}_products`;
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

async function login(app: INestApplication): Promise<string> {
  const response = await request(httpServer(app))
    .post('/auth/login')
    .set('Origin', allowedOrigin)
    .set('X-CSRF-Protection', '1')
    .send({ email: 'creator@example.com', password: 'senha-super-secreta' });
  const cookie = response.headers['set-cookie']?.[0];

  if (response.status !== 204 || cookie === undefined) {
    throw new Error('O login E2E não retornou o cookie esperado.');
  }

  return cookie.split(';')[0] ?? cookie;
}

describe('POST /products', () => {
  let app: INestApplication;
  let accessCookie: string;

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

    await request(httpServer(app))
      .post('/auth/register')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({
        email: 'creator@example.com',
        name: 'Creator',
        password: 'senha-super-secreta',
      })
      .expect(201);
    accessCookie = await login(app);
  });

  afterAll(async () => {
    await app.close();
    await deleteTableIfPresent(usersTableName);
    await deleteTableIfPresent(productsTableName);
    client.destroy();
    documentClient.destroy();
  });

  it.each([
    {
      body: { description: 'Descrição', imageUrl: 'https://example.com/p.png', name: 'A', price: 10 },
      field: 'name',
    },
    {
      body: { description: '', imageUrl: 'https://example.com/p.png', name: 'Produto', price: 10 },
      field: 'description',
    },
    {
      body: { description: 'Descrição', imageUrl: 'https://example.com/p.png', name: 'Produto', price: 10.001 },
      field: 'price',
    },
    {
      body: { description: 'Descrição', imageUrl: 'ftp://example.com/p.png', name: 'Produto', price: 10 },
      field: 'imageUrl',
    },
    {
      body: { description: 'Descrição', imageUrl: 'https://example.com/p.png', name: 'Produto' },
      field: 'price ausente',
    },
    {
      body: { description: 'Descrição', imageUrl: 'https://example.com/p.png', name: 'Produto', price: 10, ownerId: 'forbidden' },
      field: 'propriedade desconhecida',
    },
    {
      body: { description: null, imageUrl: 'https://example.com/p.png', name: 'Produto', price: 10 },
      field: 'description nula',
    },
  ])('returns VALIDATION_ERROR without persisting $field', async ({ body }) => {
    const response = await request(httpServer(app))
      .post('/products')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', accessCookie)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(response.body.errors).toEqual(expect.any(Array));

    const scan = await documentClient.send(new ScanCommand({ TableName: productsTableName }));
    expect(scan.Count).toBe(0);
  });

  it('creates a complete product with generated identity and UTC dates', async () => {
    const response = await request(httpServer(app))
      .post('/products')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', accessCookie)
      .send({
        description: 'Descrição do produto',
        imageUrl: 'https://example.com/product.png',
        name: 'Produto',
        price: 99.9,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      description: 'Descrição do produto',
      id: expect.any(String),
      imageUrl: 'https://example.com/product.png',
      name: 'Produto',
      price: 99.9,
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });
    expect(response.body.createdAt).toBe(response.body.updatedAt);

    const scan = await documentClient.send(new ScanCommand({ TableName: productsTableName }));
    expect(scan.Items).toEqual([
      {
        createdAt: response.body.createdAt,
        description: 'Descrição do produto',
        id: response.body.id,
        imageUrl: 'https://example.com/product.png',
        name: 'Produto',
        price: 99.9,
        updatedAt: response.body.updatedAt,
      },
    ]);
  });

  it('requires both the authentication cookie and CSRF protection', async () => {
    const withoutCookie = await request(httpServer(app))
      .post('/products')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1')
      .send({
        description: 'Descrição',
        imageUrl: 'https://example.com/p.png',
        name: 'Produto',
        price: 10,
      });
    const withoutCsrf = await request(httpServer(app))
      .post('/products')
      .set('Origin', allowedOrigin)
      .set('Cookie', accessCookie)
      .send({
        description: 'Descrição',
        imageUrl: 'https://example.com/p.png',
        name: 'Produto',
        price: 10,
      });

    expect(withoutCookie.status).toBe(401);
    expect(withoutCookie.body.code).toBe('UNAUTHORIZED');
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.code).toBe('REQUEST_FORBIDDEN');
  });

  it('publishes the protected creation contract in OpenAPI', async () => {
    const response = await request(httpServer(app)).get('/docs-json');
    const operation = response.body.paths['/products'].post;

    expect(response.status).toBe(200);
    expect(operation.responses).toEqual(
      expect.objectContaining({
        '201': expect.any(Object),
        '400': expect.any(Object),
        '401': expect.any(Object),
        '403': expect.any(Object),
      }),
    );
    expect(operation.security).toEqual([{ cookie: [] }]);
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'X-CSRF-Protection', in: 'header' }),
      ]),
    );
  });
});
