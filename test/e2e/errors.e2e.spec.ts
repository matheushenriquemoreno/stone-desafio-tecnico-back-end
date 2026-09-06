import {
  Body,
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  Post,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import type { Server } from 'node:http';
import request from 'supertest';

import { ApplicationError } from '../../src/shared/application/errors/application-error';
import { CLOCK } from '../../src/shared/application/ports/clock';
import { ID_GENERATOR } from '../../src/shared/application/ports/id-generator';
import {
  REQUEST_LOGGER,
  type RequestLogEntry,
  type RequestLogger,
} from '../../src/shared/application/ports/request-logger';
import { FixedClock } from '../../src/shared/application/testing/fixed-clock';
import { FixedIdGenerator } from '../../src/shared/application/testing/fixed-id-generator';
import { ApiExceptionFilter } from '../../src/shared/presentation/errors/api-exception.filter';
import { CorrelationIdMiddleware } from '../../src/shared/presentation/http/correlation-id.middleware';
import { RequestLoggingInterceptor } from '../../src/shared/presentation/logging/request-logging.interceptor';
import { PublicValidationPipe } from '../../src/shared/presentation/validation/public-validation.pipe';

class ProbeRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('probe')
class ProbeController {
  @Get('known')
  knownError(): never {
    throw new ApplicationError({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'O e-mail já está cadastrado.',
      statusCode: 409,
    });
  }

  @Get('unexpected')
  unexpectedError(): never {
    throw new Error('internal-password-or-stack-secret');
  }

  @Post('validation')
  validation(@Body() body: ProbeRequestDto): ProbeRequestDto {
    return body;
  }
}

class CapturingRequestLogger implements RequestLogger {
  readonly entries: RequestLogEntry[] = [];

  log(entry: RequestLogEntry): void {
    this.entries.push(entry);
  }
}

function createProbeModule(logger: CapturingRequestLogger) {
  @Module({
    controllers: [ProbeController],
    providers: [
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
      { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
      {
        provide: CLOCK,
        useValue: new FixedClock(new Date('2026-09-04T12:00:00.000Z')),
      },
      {
        provide: ID_GENERATOR,
        useValue: new FixedIdGenerator(['generated-correlation-id']),
      },
      { provide: REQUEST_LOGGER, useValue: logger },
    ],
  })
  class ProbeModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    }
  }

  return ProbeModule;
}

describe('HTTP error contract', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let logger: CapturingRequestLogger;

  beforeEach(async () => {
    logger = new CapturingRequestLogger();
    app = await NestFactory.create(createProbeModule(logger), { logger: false });
    app.useGlobalPipes(new PublicValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns expected application errors with a propagated correlation ID', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/probe/known')
      .set('X-Correlation-Id', 'known-correlation');

    expect(response.status).toBe(409);
    expect(response.headers['x-correlation-id']).toBe('known-correlation');
    expect(response.body).toEqual({
      code: 'EMAIL_ALREADY_EXISTS',
      correlationId: 'known-correlation',
      message: 'O e-mail já está cadastrado.',
      statusCode: 409,
    });
    expect(logger.entries.at(-1)).toMatchObject({
      correlationId: 'known-correlation',
      errorCode: 'EMAIL_ALREADY_EXISTS',
      level: 'error',
      method: 'GET',
      route: '/probe/known',
      statusCode: 409,
    });
  });

  it('returns sanitized validation fields without received sensitive values', async () => {
    const secret = 'senha-super-secreta';
    const response = await request(app.getHttpServer() as Server)
      .post('/probe/validation')
      .send({ name: '', password: secret });
    const serializedResponse = JSON.stringify(response.body);
    const serializedLogs = JSON.stringify(logger.entries);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [
        {
          code: 'REQUIRED_FIELD',
          field: 'name',
        },
      ],
      statusCode: 400,
    });
    expect(serializedResponse).not.toContain(secret);
    expect(serializedResponse).not.toContain('stack');
    expect(serializedLogs).not.toContain(secret);
  });

  it('returns a generic 500 and logs only safe request metadata', async () => {
    const secret = 'internal-password-or-stack-secret';
    const response = await request(app.getHttpServer() as Server)
      .get('/probe/unexpected')
      .set('X-Correlation-Id', 'unexpected-correlation');
    const serializedResponse = JSON.stringify(response.body);
    const serializedLogs = JSON.stringify(logger.entries);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: 'INTERNAL_ERROR',
      correlationId: 'unexpected-correlation',
      message: 'Ocorreu um erro interno.',
      statusCode: 500,
    });
    expect(serializedResponse).not.toContain(secret);
    expect(serializedResponse).not.toContain('stack');
    expect(serializedLogs).not.toContain(secret);
    expect(serializedLogs).not.toContain('password');
    expect(logger.entries.at(-1)).toMatchObject({
      correlationId: 'unexpected-correlation',
      errorCode: 'INTERNAL_ERROR',
      level: 'error',
      method: 'GET',
      route: '/probe/unexpected',
      statusCode: 500,
    });
  });
});
