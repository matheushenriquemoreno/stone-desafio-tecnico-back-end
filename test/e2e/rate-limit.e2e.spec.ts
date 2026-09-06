import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import {
  RATE_LIMITER,
  type RateLimiter,
} from '../../src/shared/application/ports/rate-limiter';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';

@Controller('rate-limit-probe')
class RateLimitProbeController {
  static calls = 0;

  @Get('fallback')
  get(): { ok: true } {
    RateLimitProbeController.calls += 1;
    return { ok: true };
  }
}

describe('rate limit HTTP pipeline', () => {
  let app: INestApplication;
  let limiter: RateLimiter;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    process.env.AWS_REGION = 'us-east-1';
    process.env.DYNAMODB_TABLE_PREFIX = '';
    process.env.USERS_TABLE_NAME = `rate_limit_${process.pid}_users`;
    process.env.PRODUCTS_TABLE_NAME = `rate_limit_${process.pid}_products`;
    process.env.JWT_SECRET = 'a-development-secret-with-at-least-32-characters';
    process.env.JWT_ISSUER = 'stone-api';
    process.env.JWT_AUDIENCE = 'stone-web';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.TRUSTED_PROXY_IPS = '';
    process.env.COOKIE_NAME = 'stone_access_token';
    process.env.COOKIE_SECURE = 'false';

    const { AppModule } = await import('../../src/app.module');
    @Module({
      controllers: [RateLimitProbeController],
      imports: [AppModule],
    })
    class RateLimitProbeModule {}

    app = await NestFactory.create(RateLimitProbeModule, { logger: false });
    const configService = app.get(ConfigService<AppConfig>);
    app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
    await app.init();
    limiter = app.get(RATE_LIMITER);
  });

  beforeEach(() => {
    limiter.clear();
    RateLimitProbeController.calls = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks the request after the fallback limit and never calls the controller', async () => {
    const responses = [];

    for (let index = 0; index < 31; index += 1) {
      responses.push(
        await request(app.getHttpServer()).get('/rate-limit-probe/fallback'),
      );
    }

    const blockedResponse = responses.at(-1);
    expect(responses.slice(0, 30).every((response) => response.status === 200)).toBe(
      true,
    );
    expect(blockedResponse?.status).toBe(429);
    expect(blockedResponse?.headers['retry-after']).toMatch(/^\d+$/);
    expect(blockedResponse?.body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });
    expect(JSON.stringify(blockedResponse?.body)).not.toContain('203.0.113');
    expect(blockedResponse?.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(RateLimitProbeController.calls).toBe(30);
  });

  it('does not consume the operation bucket for an authorized CORS preflight', async () => {
    const path = '/rate-limit-probe/options';
    const preflight = await request(app.getHttpServer())
      .options(path)
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(preflight.status).toBe(204);

    const responses = [];
    for (let index = 0; index < 31; index += 1) {
      responses.push(await request(app.getHttpServer()).get(path));
    }

    expect(responses.slice(0, 30).every((response) => response.status === 404)).toBe(
      true,
    );
    expect(responses.at(-1)?.status).toBe(429);
  });
});
