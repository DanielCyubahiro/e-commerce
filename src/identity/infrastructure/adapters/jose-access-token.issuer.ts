// jose is held on the 4.x line (see package.json) rather than the house-style
// caret: 6.x ships ESM-only with no `require` export, which breaks this repo's
// CommonJS Jest config across every suite that imports the identity
// infrastructure barrel. The pin is exact because a 4.16 backport could
// reintroduce that same break.
import { SignJWT, jwtVerify } from 'jose';
import type {
  AccessClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '@/identity/application';

const ALGORITHM = 'HS256';

/**
 * The only place a JWT is named. HS256 rather than RS256 because one service
 * both signs and verifies; asymmetric keys buy nothing until something has to
 * verify without being able to sign.
 *
 * Takes its secret and lifetime as constructor arguments rather than reading
 * `ConfigService` itself, so a test can construct it directly. `useFactory` in
 * `identity.module.ts` supplies them from configuration.
 */
export class JoseAccessTokenIssuer implements AccessTokenIssuer {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(claims: AccessClaims): Promise<IssuedAccessToken> {
    const token = await new SignJWT({
      role: claims.role,
      sid: claims.sessionId,
    })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.key);

    return { token, expiresInSeconds: this.ttlSeconds };
  }

  /**
   * `algorithms` is the load-bearing option, not a formality: without it a
   * verifier accepts whatever algorithm the token's own header names, which is
   * how algorithm-confusion forgeries get in. Expiry is checked by `jwtVerify`
   * itself and surfaces here as a thrown error, hence null.
   */
  async verify(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
      });

      const { sub, role, sid } = payload;

      if (
        typeof sub !== 'string' ||
        typeof role !== 'string' ||
        typeof sid !== 'string'
      ) {
        return null;
      }

      return { userId: sub, role, sessionId: sid };
    } catch {
      return null;
    }
  }
}
