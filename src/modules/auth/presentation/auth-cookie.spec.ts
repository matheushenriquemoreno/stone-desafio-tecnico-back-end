import { createAuthCookieOptions } from './auth-cookie';

describe('auth cookie policy', () => {
  it('keeps the published cookie scope and lifetime explicit', () => {
    expect(
      createAuthCookieOptions({
        cookieName: '__Host-stone_access_token',
        cookieSecure: true,
      }),
    ).toEqual({
      httpOnly: true,
      maxAge: 900_000,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });
});
