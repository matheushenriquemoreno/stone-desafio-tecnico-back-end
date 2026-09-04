import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { setupOpenApi } from '../../src/shared/presentation/openapi/setup-openapi';

describe('OpenAPI export', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    process.env.AWS_REGION = 'us-east-1';
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = `openapi_${process.pid}_users`;
    process.env.PRODUCTS_TABLE_NAME = `openapi_${process.pid}_products`;
    process.env.JWT_SECRET = 'a-development-secret-with-at-least-32-characters';
    process.env.JWT_ISSUER = 'stone-api';
    process.env.JWT_AUDIENCE = 'stone-web';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.TRUSTED_PROXY_IPS = '';
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    app = await NestFactory.create(AppModule, { logger: false });
    const configService = app.get(ConfigService<AppConfig>);
    app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
    setupOpenApi(app, configService.getOrThrow('cookieName'));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves a navigable UI and a valid JSON document without Bearer auth', async () => {
    const uiResponse = await request(app.getHttpServer()).get('/docs');
    const jsonResponse = await request(app.getHttpServer()).get('/docs-json');
    const document = jsonResponse.body as {
      components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, { in?: string; type?: string; scheme?: string }>;
      };
      openapi?: string;
      paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
    };
    const expectedPaths = [
      '/auth/register',
      '/auth/login',
      '/auth/logout',
      '/health',
      '/products',
      '/products/{id}',
    ];

    expect(uiResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths ?? {}).sort()).toEqual(expectedPaths.sort());

    const operations = Object.values(document.paths ?? {}).flatMap((path) =>
      Object.values(path),
    );
    expect(operations).toHaveLength(9);
    for (const operation of operations) {
      expect(operation.responses).toEqual(
        expect.objectContaining({ '429': expect.any(Object) }),
      );
      expect(operation.responses?.['429']).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Retry-After': expect.any(Object),
          }),
        }),
      );
    }

    const schemes = Object.values(document.components?.securitySchemes ?? {});
    expect(schemes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: 'cookie', type: 'apiKey' }),
      ]),
    );
    expect(
      schemes.some((scheme) => scheme.type === 'http' && scheme.scheme === 'bearer'),
    ).toBe(false);
    expect(document.components?.schemas?.ApiErrorDto).toBeDefined();
  });
});
