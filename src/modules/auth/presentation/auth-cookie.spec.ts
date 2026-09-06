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
      sameSite: 'strict',
      secure: true,
    });
  });

  it('sets the same scope with zero lifetime when the cookie is expired', () => {
    expect(
      createAuthCookieOptions({
        cookieName: '__Host-stone_access_token',
        cookieSecure: true,
      }, 0),
    ).toEqual({
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'strict',
      secure: true,
    });
  });
});
