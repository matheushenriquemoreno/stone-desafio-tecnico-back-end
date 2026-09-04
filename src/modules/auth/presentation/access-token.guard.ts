import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import passport from 'passport';

import type { AuthenticatedUser } from './cookie-access-token.strategy';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null || !('userId' in value)) {
    return false;
  }

  const userId = value.userId;
  return typeof userId === 'string' && userId.length > 0;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthenticatedRequest>();
    const response = httpContext.getResponse<Response>();

    return new Promise((resolve, reject) => {
      const rejectUnauthorized = (): void => {
        reject(new UnauthorizedException());
      };

      passport.authenticate(
        'cookie-access-token',
        (error: unknown, user: unknown): void => {
          if (error !== null && error !== undefined) {
            rejectUnauthorized();
            return;
          }

          if (!isAuthenticatedUser(user)) {
            rejectUnauthorized();
            return;
          }

          request.user = user;
          resolve(true);
        },
      )(request, response, rejectUnauthorized);
    });
  }
}
