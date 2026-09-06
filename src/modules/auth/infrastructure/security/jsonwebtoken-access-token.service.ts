import jwt, { type JwtPayload, type VerifyOptions } from 'jsonwebtoken';

import type { Clock } from '../../../../shared/application/ports/clock';
import type {
  AccessTokenIdentity,
  AccessTokenService,
} from '../../application/ports/access-token-service';

const ACCESS_TOKEN_TTL_SECONDS = 900;
const JWT_ALGORITHM = 'HS256' as const;

interface AccessTokenClaims extends JwtPayload {
  readonly aud: string;
  readonly exp: number;
  readonly iat: number;
  readonly iss: string;
  readonly sub: string;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function readClaims(decodedToken: string | JwtPayload): AccessTokenClaims | null {
  if (typeof decodedToken === 'string') {
    return null;
  }

  const claims = decodedToken as Partial<AccessTokenClaims>;
  const claimNames = Object.keys(decodedToken).sort();
  const expectedClaimNames = ['aud', 'exp', 'iat', 'iss', 'sub'];

  if (
    claimNames.length !== expectedClaimNames.length ||
    claimNames.some((claimName, index) => claimName !== expectedClaimNames[index])
  ) {
    return null;
  }

  if (
    typeof claims.aud !== 'string' ||
    !isInteger(claims.exp) ||
    !isInteger(claims.iat) ||
    typeof claims.iss !== 'string' ||
    typeof claims.sub !== 'string' ||
    claims.sub.length === 0 ||
    claims.exp - claims.iat !== ACCESS_TOKEN_TTL_SECONDS
  ) {
    return null;
  }

  return claims as AccessTokenClaims;
}

export class JsonWebTokenAccessTokenService implements AccessTokenService {
  constructor(
    private readonly clock: Clock,
    private readonly secret: string,
    private readonly issuer: string,
    private readonly audience: string,
  ) {}

  issue(subject: string): string {
    if (subject.length === 0) {
      throw new Error('O identificador do sujeito do token é obrigatório.');
    }

    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);

    return jwt.sign(
      { sub: subject, iat: issuedAt },
      this.secret,
      {
        algorithm: JWT_ALGORITHM,
        audience: this.audience,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: this.issuer,
      },
    );
  }

  verify(token: string): AccessTokenIdentity | null {
    if (token.length === 0) {
      return null;
    }

    const verifyOptions: VerifyOptions = {
      algorithms: [JWT_ALGORITHM],
      audience: this.audience,
      clockTimestamp: Math.floor(this.clock.now().getTime() / 1000),
      issuer: this.issuer,
    };

    try {
      const decodedToken = jwt.verify(token, this.secret, verifyOptions);
      const claims = readClaims(decodedToken);

      if (claims === null) {
        return null;
      }

      return {
        expiresAt: new Date(claims.exp * 1000),
        issuedAt: new Date(claims.iat * 1000),
        subject: claims.sub,
      };
    } catch {
      return null;
    }
  }
}
