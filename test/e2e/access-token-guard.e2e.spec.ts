import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';
import { AccessTokenGuard } from '../../src/modules/auth/presentation/access-token.guard';

const secret = 'a-development-secret-with-at-least-32-characters';
const issuer = 'stone-api';
const audience = 'stone-web';

@Controller('protected-probe')
class ProtectedProbeController {
  @Get()
  @UseGuards(AccessTokenGuard)
  get(): { authenticated: true } {
    return { authenticated: true };
  }
}

function validToken(): string {
  return jwt.sign(
    { sub: 'user-123' },
    secret,
    { algorithm: 'HS256', audience, expiresIn: 900, issuer },
  );
}

function expiredToken(): string {
  return jwt.sign(
    { sub: 'user-123' },
    secret,
    { algorithm: 'HS256', audience, expiresIn: -1, issuer },
  );
}

describe('cookie access token guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    process.env.AWS_REGION = 'us-east-1';
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = `guard_${process.pid}_users`;
    process.env.PRODUCTS_TABLE_NAME = `guard_${process.pid}_products`;
    process.env.JWT_SECRET = secret;
    process.env.JWT_ISSUER = issuer;
    process.env.JWT_AUDIENCE = audience;
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    const { AppModule } = await import('../../src/app.module');
    @Module({
      controllers: [ProtectedProbeController],
      imports: [AppModule],
    })
    class AccessTokenGuardProbeModule {}

    app = await NestFactory.create(AccessTokenGuardProbeModule, {
      abortOnError: false,
      logger: false,
    });
    const configService = app.get(ConfigService<AppConfig>);
    app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
    app.useGlobalPipes(new PublicValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid JWT only when transported by the configured cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/protected-probe')
      .set('Cookie', `stone_access_token=${validToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: true });
  });

  it.each([
    { description: 'no cookie', headers: {} },
    { description: 'a malformed cookie', headers: { Cookie: 'stone_access_token=%' } },
    { description: 'an invalid signature', headers: { Cookie: 'stone_access_token=invalid' } },
    { description: 'an expired token', headers: { Cookie: `stone_access_token=${expiredToken()}` } },
    {
      description: 'a Bearer authorization header',
      headers: { Authorization: `Bearer ${validToken()}` },
    },
  ])('rejects $description with a generic unauthorized error', async ({ headers }) => {
    const requestBuilder = request(app.getHttpServer()).get('/protected-probe');

    for (const [name, value] of Object.entries(headers)) {
      requestBuilder.set(name, value);
    }

    const response = await requestBuilder;

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(JSON.stringify(response.body)).not.toContain('invalid');
    expect(JSON.stringify(response.body)).not.toContain('eyJ');
  });
});
