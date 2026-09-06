export const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');

export interface AccessTokenIdentity {
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly subject: string;
}

export interface AccessTokenService {
  issue(subject: string): string;
  verify(token: string): AccessTokenIdentity | null;
}
