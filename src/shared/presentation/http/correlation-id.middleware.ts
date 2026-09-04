import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { ID_GENERATOR, type IdGenerator } from '../../application/ports/id-generator';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

export interface CorrelationRequest extends Request {
  correlationId?: string;
}

function isSafeCorrelationId(value: string | undefined): value is string {
  return value !== undefined && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  use(request: CorrelationRequest, response: Response, next: NextFunction): void {
    const requestedCorrelationId = request.header(CORRELATION_ID_HEADER);
    const correlationId = isSafeCorrelationId(requestedCorrelationId)
      ? requestedCorrelationId
      : this.idGenerator.generate();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
