import type {
  AccessClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '@/identity/application';

/**
 * Encodes the claims as JSON prefixed by this instance's own secret, which is
 * what lets it satisfy the contract's "refuses another issuer's token" rule
 * without any cryptography. Held to the same contract suite as the jose
 * adapter, so it cannot drift.
 */
export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  constructor(
    private readonly secret = 'fake-secret',
    private readonly ttlSeconds = 900,
  ) {}

  issue(claims: AccessClaims): Promise<IssuedAccessToken> {
    return Promise.resolve({
      token: `${this.secret}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`,
      expiresInSeconds: this.ttlSeconds,
    });
  }

  verify(token: string): Promise<AccessClaims | null> {
    const prefix = `${this.secret}.`;

    if (!token.startsWith(prefix)) {
      return Promise.resolve(null);
    }

    try {
      const payload: unknown = JSON.parse(
        Buffer.from(token.slice(prefix.length), 'base64url').toString('utf8'),
      );

      return Promise.resolve(FakeAccessTokenIssuer.asClaims(payload));
    } catch {
      return Promise.resolve(null);
    }
  }

  private static asClaims(payload: unknown): AccessClaims | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const { userId, role, sessionId } = payload as Record<string, unknown>;

    if (
      typeof userId !== 'string' ||
      typeof role !== 'string' ||
      typeof sessionId !== 'string'
    ) {
      return null;
    }

    return { userId, role, sessionId };
  }
}
