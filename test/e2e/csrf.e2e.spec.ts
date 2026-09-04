import {
  Controller,
  Get,
  Head,
  Module,
  Options,
  Post,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

import { ID_GENERATOR } from '../../src/shared/application/ports/id-generator';
import { SecureIdGenerator } from '../../src/shared/infrastructure/identifiers/secure-id-generator';
import { ApiExceptionFilter } from '../../src/shared/presentation/errors/api-exception.filter';
import { CsrfProtectionMiddleware } from '../../src/shared/presentation/http/csrf-protection.middleware';
import { CorrelationIdMiddleware } from '../../src/shared/presentation/http/correlation-id.middleware';

const allowedOrigin = 'https://app.example.com';

@Controller('probe')
class CsrfProbeController {
  static calls = 0;

  @Get()
  get(): { method: 'GET' } {
    CsrfProbeController.calls += 1;
    return { method: 'GET' };
  }

  @Head()
  head(): void {
    CsrfProbeController.calls += 1;
  }

  @Options()
  options(): void {
    CsrfProbeController.calls += 1;
  }

  @Post()
  create(): { created: true } {
    CsrfProbeController.calls += 1;
    return { created: true };
  }
}

@Module({
  controllers: [CsrfProbeController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: ConfigService,
      useValue: {
        getOrThrow: () => [allowedOrigin],
      },
    },
    {
      provide: ID_GENERATOR,
      useValue: new SecureIdGenerator(),
    },
  ],
})
class CsrfProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, CsrfProtectionMiddleware).forRoutes('*');
  }
}

describe('proteção contra CSRF por SameSite e origem', () => {
  let app: INestApplication;

  beforeEach(async () => {
    CsrfProbeController.calls = 0;
    app = await NestFactory.create(CsrfProbeModule, { logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows a mutation from an exact allowed Origin without a custom header', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Origin', allowedOrigin);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(CsrfProbeController.calls).toBe(1);
  });

  it('allows the API own origin by exact protocol and host match', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Host', 'api.example.com')
      .set('Origin', 'http://api.example.com');

    expect(response.status).toBe(201);
    expect(CsrfProbeController.calls).toBe(1);
  });

  it('allows a mutation with an allowed Referer when Origin is absent', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Referer', `${allowedOrigin}/products/123`);

    expect(response.status).toBe(201);
    expect(CsrfProbeController.calls).toBe(1);
  });

  it.each(['https://evil.example.com', 'null', 'not-an-origin'])(
    'rejects an unauthorized or malformed Origin value %j before the controller',
    async (origin) => {
      const response = await request(app.getHttpServer() as Server)
        .post('/probe')
        .set('Origin', origin);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'REQUEST_FORBIDDEN',
        statusCode: 403,
      });
      expect(response.body.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(CsrfProbeController.calls).toBe(0);
    },
  );

  it.each(['https://evil.example.com/products', 'not-a-url'])(
    'rejects an unauthorized or malformed Referer value %j',
    async (referer) => {
      const response = await request(app.getHttpServer() as Server)
        .post('/probe')
        .set('Referer', referer);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'REQUEST_FORBIDDEN',
        statusCode: 403,
      });
      expect(CsrfProbeController.calls).toBe(0);
    },
  );

  it('does not use an allowed Referer to compensate for an invalid Origin', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Origin', 'https://evil.example.com')
      .set('Referer', `${allowedOrigin}/products`);

    expect(response.status).toBe(403);
    expect(CsrfProbeController.calls).toBe(0);
  });

  it('allows a client without browser context headers to continue', async () => {
    const response = await request(app.getHttpServer() as Server).post('/probe');

    expect(response.status).toBe(201);
    expect(CsrfProbeController.calls).toBe(1);
  });

  it('skips origin validation for GET and HEAD', async () => {
    const getResponse = await request(app.getHttpServer() as Server)
      .get('/probe')
      .set('Origin', 'https://evil.example.com');
    const headResponse = await request(app.getHttpServer() as Server)
      .head('/probe')
      .set('Origin', 'https://evil.example.com');

    expect(getResponse.status).toBe(200);
    expect(headResponse.status).toBe(200);
  });

  it('skips origin validation for OPTIONS preflight', async () => {
    const response = await request(app.getHttpServer() as Server)
      .options('/probe')
      .set('Origin', 'https://evil.example.com');

    expect(response.status).toBeLessThan(400);
  });
});
