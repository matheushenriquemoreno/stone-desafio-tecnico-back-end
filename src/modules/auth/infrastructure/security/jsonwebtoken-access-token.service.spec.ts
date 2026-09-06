import jwt from 'jsonwebtoken';

import { FixedClock } from '../../../../shared/application/testing/fixed-clock';
import { JsonWebTokenAccessTokenService } from './jsonwebtoken-access-token.service';

const secret = 'a-development-secret-with-at-least-32-characters';
const issuer = 'stone-api';
const audience = 'stone-web';
const issuedAt = new Date('2026-09-04T12:00:00.000Z');

function createService(instant: Date = issuedAt): JsonWebTokenAccessTokenService {
  return new JsonWebTokenAccessTokenService(
    new FixedClock(instant),
    secret,
    issuer,
    audience,
  );
}

describe('JsonWebTokenAccessTokenService', () => {
  it('issues only the approved HS256 claims with an exact 900-second lifetime', () => {
    const service = createService();
    const token = service.issue('user-123');
    const claims = jwt.decode(token) as Record<string, unknown>;

    expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
    expect(claims).toMatchObject({
      aud: audience,
      iss: issuer,
      sub: 'user-123',
    });
    expect(claims.exp).toBe((claims.iat as number) + 900);
    expect(JSON.stringify(claims)).not.toContain('name');
    expect(JSON.stringify(claims)).not.toContain('email');
    expect(JSON.stringify(claims)).not.toContain(secret);
    expect(service.verify(token)).toEqual({
      expiresAt: new Date('2026-09-04T12:15:00.000Z'),
      issuedAt,
      subject: 'user-123',
    });
  });

  it.each([
    {
      description: 'an invalid signature',
      mutate: (token: string) => `${token.slice(0, -1)}x`,
    },
    {
      description: 'a token signed with another algorithm',
      mutate: () =>
        jwt.sign(
          { sub: 'user-123' },
          secret,
          { algorithm: 'HS384', audience, issuer },
        ),
    },
    {
      description: 'a token with another issuer',
      mutate: () =>
        jwt.sign(
          { sub: 'user-123' },
          secret,
          { algorithm: 'HS256', audience, issuer: 'another-api' },
        ),
    },
    {
      description: 'a token with another audience',
      mutate: () =>
        jwt.sign(
          { sub: 'user-123' },
          secret,
          { algorithm: 'HS256', audience: 'another-client', issuer },
        ),
    },
  ])('rejects $description without exposing a cryptographic reason', ({ mutate }) => {
    const service = createService();
    const token = service.issue('user-123');

    expect(service.verify(mutate(token))).toBeNull();
  });

  it('rejects an expired token using the injected clock', () => {
    const token = createService().issue('user-123');
    const expiredService = createService(new Date('2026-09-04T12:15:01.000Z'));

    expect(expiredService.verify(token)).toBeNull();
  });

  it('rejects tokens with claims outside the public contract', () => {
    const token = jwt.sign(
      { role: 'admin', sub: 'user-123' },
      secret,
      {
        algorithm: 'HS256',
        audience,
        expiresIn: 900,
        issuer,
      },
    );

    expect(createService().verify(token)).toBeNull();
  });
});
