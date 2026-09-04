import {
  Controller,
  Module,
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

describe('CSRF protection', () => {
  let app: INestApplication;

  beforeEach(async () => {
    CsrfProbeController.calls = 0;
    app = await NestFactory.create(CsrfProbeModule, { logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows a mutation with the literal CSRF header and an allowed origin', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Origin', allowedOrigin)
      .set('X-CSRF-Protection', '1');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(CsrfProbeController.calls).toBe(1);
  });

  it.each([undefined, '0', 'true', '01'])(
    'rejects a mutation with invalid CSRF value %j before the controller',
    async (csrfHeader) => {
      const requestBuilder = request(app.getHttpServer() as Server)
        .post('/probe')
        .set('Origin', allowedOrigin);

      if (csrfHeader !== undefined) {
        requestBuilder.set('X-CSRF-Protection', csrfHeader);
      }

      const response = await requestBuilder;

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'REQUEST_FORBIDDEN',
        statusCode: 403,
      });
      expect(response.body.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(CsrfProbeController.calls).toBe(0);
    },
  );

  it('rejects an unlisted origin even when the CSRF header is present', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Origin', 'https://evil.example.com')
      .set('X-CSRF-Protection', '1');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'REQUEST_FORBIDDEN',
      statusCode: 403,
    });
    expect(CsrfProbeController.calls).toBe(0);
  });

  it('accepts a non-browser mutation without Origin when CSRF is present', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('X-CSRF-Protection', '1');

    expect(response.status).toBe(201);
    expect(CsrfProbeController.calls).toBe(1);
  });

  it('accepts the API own origin by exact protocol and host match', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/probe')
      .set('Host', 'api.example.com')
      .set('Origin', 'http://api.example.com')
      .set('X-CSRF-Protection', '1');

    expect(response.status).toBe(201);
    expect(CsrfProbeController.calls).toBe(1);
  });
});
