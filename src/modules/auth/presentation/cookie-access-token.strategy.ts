import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';

import type { AccessTokenIdentity, AccessTokenService } from '../application/ports/access-token-service';
import { ACCESS_TOKEN_SERVICE } from '../application/ports/access-token-service';
import type { AppConfig } from '../../../shared/infrastructure/configuration';

export interface AuthenticatedUser {
  readonly userId: string;
}

function accessTokenFromCookie(request: Request, cookieName: string): string | null {
  const cookieHeader = request.header('Cookie');

  if (cookieHeader === undefined) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex < 0 || cookie.slice(0, separatorIndex).trim() !== cookieName) {
      continue;
    }

    const rawValue = cookie.slice(separatorIndex + 1).trim();

    if (rawValue.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

@Injectable()
export class CookieAccessTokenStrategy extends PassportStrategy(
  Strategy,
  'cookie-access-token',
) {
  constructor(
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    super(
      {
        algorithms: ['HS256'],
        audience: configService.getOrThrow('jwtAudience'),
        jwtFromRequest: (request: Request) =>
          accessTokenFromCookie(request, configService.getOrThrow('cookieName')),
        secretOrKey: configService.getOrThrow('jwtSecret'),
        issuer: configService.getOrThrow('jwtIssuer'),
      },
    );
  }

  override authenticate(request: Request): void {
    const token = accessTokenFromCookie(request, this.cookieName);

    if (token === null) {
      this.fail(401);
      return;
    }

    const identity = this.accessTokenService.verify(token);

    if (identity === null) {
      this.fail(401);
      return;
    }

    this.success(this.validate(identity));
  }

  validate(identity: AccessTokenIdentity): AuthenticatedUser {
    return { userId: identity.subject };
  }

  private get cookieName(): string {
    return this.configService.getOrThrow('cookieName');
  }
}
