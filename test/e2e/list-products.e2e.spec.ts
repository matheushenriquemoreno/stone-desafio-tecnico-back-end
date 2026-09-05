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
const usersTableName = `list_product_${process.pid}_users`;
const productsTableName = `list_product_${process.pid}_products`;
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

async function register(app: INestApplication): Promise<void> {
  await request(httpServer(app))
    .post('/auth/register')
    .set('Origin', allowedOrigin)
    .send({ email: 'list-reader@example.com', name: 'List Reader', password: 'senha-super-secreta' })
    .expect(201);
}

async function login(app: INestApplication): Promise<string> {
  const response = await request(httpServer(app))
    .post('/auth/login')
    .set('Origin', allowedOrigin)
    .send({ email: 'list-reader@example.com', password: 'senha-super-secreta' });
  const cookie = response.headers['set-cookie']?.[0];

  if (response.status !== 204 || cookie === undefined) {
    throw new Error('O login E2E não retornou o cookie esperado.');
  }

  return cookie.split(';')[0] ?? cookie;
}

describe('GET /products', () => {
  let app: INestApplication;
  let limiter: RateLimiter;
  let accessCookie: string;
  const productIds: string[] = [];

  async function seedProducts(): Promise<void> {
    if (productIds.length > 0) {
      return;
    }

    for (let index = 1; index <= 21; index += 1) {
      const response = await request(httpServer(app))
        .post('/products')
        .set('Origin', allowedOrigin)
        .set('Cookie', accessCookie)
        .set('X-Forwarded-For', `198.51.100.${index}`)
        .send({
          description: `Descrição do produto ${index}`,
          imageUrl: `https://example.com/product-${index}.png`,
          name: `Produto ${index}`,
          price: index,
        })
        .expect(201);

      productIds.push(response.body.id as string);
    }
  }

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
    process.env.TRUSTED_PROXY_IPS = '127.0.0.1';
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
    limiter = app.get(RATE_LIMITER);

    await register(app);
    accessCookie = await login(app);
  });

  afterAll(async () => {
    await app.close();
    await deleteTableIfPresent(usersTableName);
    await deleteTableIfPresent(productsTableName);
    client.destroy();
  });

  beforeEach(() => {
    limiter.clear();
  });

  it('returns an empty page without nextCursor for an empty catalog', async () => {
    const response = await request(httpServer(app))
      .get('/products')
      .set('Cookie', accessCookie)
      .expect(200);

    expect(response.body).toEqual({ items: [] });
    expect(response.body).not.toHaveProperty('nextCursor');
  });

  it('uses the default limit of 20 and returns a cursor for the next page', async () => {
    await seedProducts();

    const response = await request(httpServer(app))
      .get('/products')
      .set('Cookie', accessCookie)
      .expect(200);

    expect(response.body.items).toHaveLength(20);
    expect(response.body.nextCursor).toEqual(expect.any(String));
  });

  it('follows opaque cursors sequentially without assuming Scan ordering', async () => {
    await seedProducts();

    const listedIds: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await request(httpServer(app))
        .get('/products')
        .query(cursor === undefined ? { limit: 1 } : { cursor, limit: 1 })
        .set('Cookie', accessCookie)
        .expect(200);
      if (response.body.items.length === 0) {
        expect(response.body).not.toHaveProperty('nextCursor');
        break;
      }

      expect(response.body.items).toHaveLength(1);
      listedIds.push(response.body.items[0].id as string);
      cursor = response.body.nextCursor as string | undefined;

      if (cursor === undefined) {
        expect(response.body).not.toHaveProperty('nextCursor');
      }
    } while (cursor !== undefined);

    expect(new Set(listedIds).size).toBe(listedIds.length);
    expect(listedIds).toEqual(expect.arrayContaining(productIds));
  });

  it('accepts the inclusive limits and omits the cursor on the final page', async () => {
    await seedProducts();

    for (const limit of [1, 100]) {
      const response = await request(httpServer(app))
        .get('/products')
        .query({ limit })
        .set('Cookie', accessCookie)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(limit);
    }

    const finalPage = await request(httpServer(app))
      .get('/products')
      .query({ limit: 100 })
      .set('Cookie', accessCookie)
      .expect(200);
    expect(finalPage.body).not.toHaveProperty('nextCursor');
  });

  it.each(['0', '101', '1.5', 'abc'])('rejects an invalid limit %s', async (limit) => {
    const response = await request(httpServer(app))
      .get('/products')
      .query({ limit })
      .set('Cookie', accessCookie);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('rejects an invalid cursor without exposing its payload', async () => {
    const response = await request(httpServer(app))
      .get('/products')
      .query({ cursor: 'invalid-cursor-payload' })
      .set('Cookie', accessCookie);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(JSON.stringify(response.body)).not.toContain('invalid-cursor-payload');
  });

  it('requires authentication', async () => {
    const response = await request(httpServer(app)).get('/products');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('publishes query, pagination and error contracts in OpenAPI', async () => {
    const response = await request(httpServer(app)).get('/docs-json');
    const operation = response.body.paths['/products'].get;

    expect(response.status).toBe(200);
    expect(operation.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '400': expect.any(Object),
        '401': expect.any(Object),
      }),
    );
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'limit', in: 'query' }),
        expect.objectContaining({ name: 'cursor', in: 'query' }),
      ]),
    );
    expect(response.body.components.schemas.ProductsPageResponseDto).toBeDefined();
  });
});
