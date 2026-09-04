import type { CookieOptions, Response } from 'express';

const ACCESS_TOKEN_MAX_AGE_MILLISECONDS = 900_000;

export interface AuthCookieSettings {
  readonly cookieName: string;
  readonly cookieSecure: boolean;
}

export function createAuthCookieOptions(
  settings: AuthCookieSettings,
  maxAge = ACCESS_TOKEN_MAX_AGE_MILLISECONDS,
): CookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: settings.cookieSecure,
  };
}

export function setAccessTokenCookie(
  response: Response,
  token: string,
  settings: AuthCookieSettings,
): void {
  response.cookie(
    settings.cookieName,
    token,
    createAuthCookieOptions(settings),
  );
}
