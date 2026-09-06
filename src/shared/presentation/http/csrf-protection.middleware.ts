import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { RequestForbiddenError } from '../../application/errors/application-error';
import type { AppConfig } from '../../infrastructure/configuration';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseOrigin(value: string): string | undefined {
  if (value === '' || value === 'null') {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.origin !== value
    ) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function parseRefererOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function isAllowedOrigin(
  request: Request,
  requestOrigin: string,
  allowedOrigins: readonly string[],
): boolean {
  const apiOrigin = `${request.protocol}://${request.get('host')}`;

  return requestOrigin === apiOrigin || allowedOrigins.includes(requestOrigin);
}

function isAllowedRequestOrigin(
  request: Request,
  allowedOrigins: readonly string[],
): boolean {
  const originHeader = request.header('Origin');

  if (originHeader !== undefined) {
    const origin = parseOrigin(originHeader);

    return origin !== undefined && isAllowedOrigin(request, origin, allowedOrigins);
  }

  const refererHeader = request.header('Referer');

  if (refererHeader !== undefined) {
    const refererOrigin = parseRefererOrigin(refererHeader);

    return (
      refererOrigin !== undefined &&
      isAllowedOrigin(request, refererOrigin, allowedOrigins)
    );
  }

  return true;
}

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const allowedOrigins = this.configService.getOrThrow('allowedOrigins');

    if (!isAllowedRequestOrigin(request, allowedOrigins)) {
      next(new RequestForbiddenError());
      return;
    }

    next();
  }
}
