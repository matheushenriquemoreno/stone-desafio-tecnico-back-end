import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { RequestForbiddenError } from '../../application/errors/application-error';
import type { AppConfig } from '../../infrastructure/configuration';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);
const CSRF_HEADER = 'X-CSRF-Protection';

function isAllowedOrigin(
  request: Request,
  requestOrigin: string,
  allowedOrigins: readonly string[],
): boolean {
  const apiOrigin = `${request.protocol}://${request.get('host')}`;

  return requestOrigin === apiOrigin || allowedOrigins.includes(requestOrigin);
}

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (!MUTATING_METHODS.has(request.method)) {
      next();
      return;
    }

    const csrfHeader = request.header(CSRF_HEADER);
    const requestOrigin = request.header('Origin');
    const allowedOrigins = this.configService.getOrThrow('allowedOrigins');
    const hasAllowedOrigin =
      requestOrigin === undefined ||
      isAllowedOrigin(request, requestOrigin, allowedOrigins);

    if (csrfHeader !== '1' || !hasAllowedOrigin) {
      next(new RequestForbiddenError());
      return;
    }

    next();
  }
}
