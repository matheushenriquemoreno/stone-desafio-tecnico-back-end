import { Controller, Get, Header, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

import { createCorsOptions } from '../../src/shared/presentation/http/cors-options';

const allowedOrigin = 'https://app.example.com';

@Controller('probe')
class ProbeController {
  static calls = 0;

  @Get()
  @Header('Retry-After', '10')
  get(): { ok: true } {
    ProbeController.calls += 1;
    return { ok: true };
  }

  @Post()
  post(): { ok: true } {
    ProbeController.calls += 1;
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class CorsProbeModule {}

describe('CORS policy', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ProbeController.calls = 0;
    app = await NestFactory.create(CorsProbeModule, { logger: false });
    app.enableCors(createCorsOptions([allowedOrigin]));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('finishes an authorized preflight before the controller pipeline', async () => {
    const response = await request(app.getHttpServer() as Server)
      .options('/probe')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toEqual(
      expect.stringContaining('GET'),
    );
    expect(response.headers['access-control-allow-methods']).toEqual(
      expect.stringContaining('POST'),
    );
    expect(response.headers['access-control-allow-methods']).toEqual(
      expect.stringContaining('PATCH'),
    );
    expect(response.headers['access-control-allow-methods']).toEqual(
      expect.stringContaining('DELETE'),
    );
    expect(response.headers['access-control-allow-methods']).toEqual(
      expect.stringContaining('OPTIONS'),
    );
    expect(response.headers['access-control-allow-headers']).toEqual(
      expect.stringContaining('Content-Type'),
    );
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(ProbeController.calls).toBe(0);
  });

  it('reflects credentials and Retry-After only for the exact allowed origin', async () => {
    const allowedResponse = await request(app.getHttpServer() as Server)
      .get('/probe')
      .set('Origin', allowedOrigin);
    const almostAllowedResponse = await request(app.getHttpServer() as Server)
      .get('/probe')
      .set('Origin', `${allowedOrigin}.evil`);

    expect(allowedResponse.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(allowedResponse.headers['access-control-allow-credentials']).toBe('true');
    expect(allowedResponse.headers['access-control-expose-headers']).toEqual(
      expect.stringContaining('Retry-After'),
    );
    expect(allowedResponse.headers['retry-after']).toBe('10');
    expect(
      almostAllowedResponse.headers['access-control-allow-origin'],
    ).toBeUndefined();
  });

  it('does not authorize a preflight from an unlisted origin', async () => {
    const response = await request(app.getHttpServer() as Server)
      .options('/probe')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(ProbeController.calls).toBe(0);
  });
});
