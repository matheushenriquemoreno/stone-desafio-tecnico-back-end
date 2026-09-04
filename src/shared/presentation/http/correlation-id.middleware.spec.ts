import type { NextFunction, Response } from 'express';

import { FixedIdGenerator } from '../../application/testing/fixed-id-generator';
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
  type CorrelationRequest,
} from './correlation-id.middleware';

function responseDouble(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};

  return {
    headers,
    setHeader(name: string, value: string): Response {
      headers[name] = value;
      return this;
    },
  } as Response & { headers: Record<string, string> };
}

function requestDouble(headerValue?: string): CorrelationRequest {
  return {
    header: () => headerValue,
  } as unknown as CorrelationRequest;
}

describe('CorrelationIdMiddleware', () => {
  it('propagates a safe incoming correlation ID', () => {
    const middleware = new CorrelationIdMiddleware(
      new FixedIdGenerator(['generated-id']),
    );
    const request = requestDouble('incoming-id');
    const response = responseDouble();
    let nextCalled = false;

    middleware.use(request, response, (() => {
      nextCalled = true;
    }) as NextFunction);

    expect(request.correlationId).toBe('incoming-id');
    expect(response.headers[CORRELATION_ID_HEADER]).toBe('incoming-id');
    expect(nextCalled).toBe(true);
  });

  it('replaces an invalid incoming value with a generated opaque ID', () => {
    const middleware = new CorrelationIdMiddleware(
      new FixedIdGenerator(['generated-id']),
    );
    const request = requestDouble('contains spaces');
    const response = responseDouble();

    middleware.use(request, response, (() => {}) as NextFunction);

    expect(request.correlationId).toBe('generated-id');
    expect(response.headers[CORRELATION_ID_HEADER]).toBe('generated-id');
  });
});
