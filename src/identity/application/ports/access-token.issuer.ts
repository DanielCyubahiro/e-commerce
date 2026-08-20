export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');

/**
 * Everything an access token asserts, and nothing more. Primitives rather than
 * `UserId` and `UserRole` because the guard reads this in the presentation
 * layer, which may not import a domain value object.
 *
 * `role` is a cache with no invalidation: a token keeps the role it was issued
 * with until it expires. Nothing branches on it today; it is here so
 * authorization is additive.
 */
export interface AccessClaims {
  userId: string;
  role: string;
  /** The rotation chain this token belongs to, so logout can revoke it. */
  sessionId: string;
}

export interface IssuedAccessToken {
  token: string;
  /** For the response body, so a client need not decode the token to know. */
  expiresInSeconds: number;
}

export interface AccessTokenIssuer {
  issue(claims: AccessClaims): Promise<IssuedAccessToken>;

  /**
   * @returns null for any token that is malformed, expired, signed by anything
   * else, or missing a claim. Never throws: the caller's only response to a bad
   * token is 401, and distinguishing the reasons would tell an attacker which
   * part of their forgery to fix.
   */
  verify(token: string): Promise<AccessClaims | null>;
}
