import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { request as sendHttpRequest } from 'node:http';
import request from 'supertest';

import type { AppConfig } from '../../src/shared/infrastructure/configuration';
import {
  RATE_LIMITER,
  type RateLimiter,
} from '../../src/shared/application/ports/rate-limiter';
import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';

@Controller('rate-limit-probe')
class RateLimitProbeController {
  static calls = 0;

  @Get('fallback')
  get(): { ok: true } {
    RateLimitProbeController.calls += 1;
    return { ok: true };
  }
}

interface HttpResult {
  readonly code?: string;
  readonly retryAfter?: string;
  readonly status: number;
}

function sendRawRequest(
  port: number,
  method: string,
  path: string,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const clientRequest = sendHttpRequest(
      {
        headers: {
          'Content-Length': '2',
          'Content-Type': 'application/json',
        },
        hostname: '127.0.0.1',
        method,
        path,
        port,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as {
            code?: string;
          };

          resolve({
            code: body.code,
            retryAfter:
              typeof response.headers['retry-after'] === 'string'
                ? response.headers['retry-after']
                : undefined,
            status: response.statusCode ?? 0,
          });
        });
      },
    );

    clientRequest.on('error', reject);
    clientRequest.end('{}');
  });
}

describe('rate limit HTTP pipeline', () => {
  let app: INestApplication;
  let limiter: RateLimiter;
  let port: number;

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
    app.useGlobalPipes(new PublicValidationPipe());
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('A aplicação de teste não abriu uma porta TCP.');
    }
    port = address.port;
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

  it('applies the explicit register policy through the mounted middleware', async () => {
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await request(app.getHttpServer()).post('/auth/register').send({}),
      );
    }

    expect(responses.slice(0, 5).every((response) => response.status === 400)).toBe(
      true,
    );
    expect(responses.at(-1)?.status).toBe(429);
    expect(responses.at(-1)?.headers['retry-after']).toMatch(/^\d+$/);
    expect(responses.at(-1)?.body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });
  });

  it('keeps the explicit register policy with a trailing slash', async () => {
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await request(app.getHttpServer()).post('/auth/register/').send({}),
      );
    }

    expect(responses.slice(0, 5).every((response) => response.status === 400)).toBe(
      true,
    );
    expect(responses.at(-1)?.status).toBe(429);
    expect(responses.at(-1)?.body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });
  });

  it('keeps the explicit register policy with different path casing', async () => {
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await request(app.getHttpServer()).post('/AUTH/REGISTER').send({}),
      );
    }

    expect(responses.slice(0, 5).every((response) => response.status === 400)).toBe(
      true,
    );
    expect(responses.at(-1)?.status).toBe(429);
    expect(responses.at(-1)?.body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });
  });

  it('keeps the explicit register policy for an absolute request target', async () => {
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await sendRawRequest(
          port,
          'POST',
          'http://untrusted.example/auth/register',
        ),
      );
    }

    expect(responses.slice(0, 5).every(({ status }) => status === 400)).toBe(true);
    expect(responses.at(-1)).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
    });
    expect(responses.at(-1)?.retryAfter).toMatch(/^\d+$/);
  });

  it('keeps raw dot segments when resolving a dynamic route policy', async () => {
    const responses = [];

    for (let index = 0; index < 21; index += 1) {
      responses.push(
        await sendRawRequest(
          port,
          'PATCH',
          'http://untrusted.example/products/%2e',
        ),
      );
    }

    expect(responses.slice(0, 20).every(({ status }) => status === 401)).toBe(true);
    expect(responses.at(-1)).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
    });
    expect(responses.at(-1)?.retryAfter).toMatch(/^\d+$/);
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
