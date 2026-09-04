import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { setupOpenApi } from '../../src/shared/presentation/openapi/setup-openapi';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';

const allowedOrigin = 'https://app.example.com';

describe('POST /auth/logout', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    process.env.AWS_REGION = 'us-east-1';
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = `logout_${process.pid}_users`;
    process.env.PRODUCTS_TABLE_NAME = `logout_${process.pid}_products`;
    process.env.JWT_SECRET = 'a-development-secret-with-at-least-32-characters';
    process.env.JWT_ISSUER = 'stone-api';
    process.env.JWT_AUDIENCE = 'stone-web';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = allowedOrigin;
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    const { AppModule } = await import('../../src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    const configService = app.get(ConfigService<AppConfig>);
    app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
    app.useGlobalPipes(new PublicValidationPipe());
    setupOpenApi(app, configService.getOrThrow('cookieName'));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { description: 'a valid cookie', cookie: 'stone_access_token=valid-token' },
    { description: 'an invalid cookie', cookie: 'stone_access_token=invalid-token' },
    { description: 'an expired cookie', cookie: 'stone_access_token=expired-token' },
    { description: 'no cookie', cookie: undefined },
  ])('returns 204 and expires the cookie with $description', async ({ cookie }) => {
    const logoutRequest = request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1');

    if (cookie !== undefined) {
      logoutRequest.set('Cookie', cookie);
    }

    const response = await logoutRequest;

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.headers['set-cookie']).toHaveLength(1);
    expect(response.headers['set-cookie']?.[0]).toEqual(
      expect.stringMatching(
        /^stone_access_token=; Max-Age=0; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
      ),
    );
    expect(response.headers['set-cookie']?.[0]).not.toContain('Domain=');
  });

  it('rejects logout without CSRF before the controller', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', allowedOrigin);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'REQUEST_FORBIDDEN',
      statusCode: 403,
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('publishes idempotent logout in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    const logoutOperation = response.body.paths['/auth/logout'].post;

    expect(response.status).toBe(200);
    expect(logoutOperation.responses).toEqual(
      expect.objectContaining({
        '204': expect.any(Object),
        '403': expect.any(Object),
      }),
    );
  });
});
