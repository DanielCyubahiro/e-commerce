import type {
  RefreshTokenId,
  SessionId,
  TokenHash,
  UserId,
} from '@/identity/domain';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface IssuedRefreshToken {
  id: RefreshTokenId;
  sessionId: SessionId;
  userId: UserId;
  tokenHash: TokenHash;
  expiresAt: Date;
}

export interface RefreshSuccessor {
  id: RefreshTokenId;
  tokenHash: TokenHash;
  expiresAt: Date;
}

/**
 * Closed and exact: a caller dispatches on `outcome` and narrows by that
 * discriminant, never by casting, so a member added here without updating
 * every switch is a compile error rather than a silent `undefined`. Only
 * `rotated` and `replayed` carry a payload.
 */
export type RotationOutcome =
  | { outcome: 'rotated'; userId: string; role: string; sessionId: string }
  | { outcome: 'replayed'; sessionId: string }
  | { outcome: 'expired' }
  | { outcome: 'revoked' }
  | { outcome: 'unknown' };

export interface RefreshTokenRepository {
  issue(token: IssuedRefreshToken): Promise<void>;

  /**
   * Why `rotate` takes the successor rather than returning a token to store
   * separately: consuming the presented token and inserting its replacement have
   * to be one transaction. Split them and a crash in between spends a token with
   * no replacement, which signs the user out and reads as a bug in reuse
   * detection rather than as a crash.
   *
   * `replayed` carries the chain so the *handler* decides to revoke it. The
   * adapter reports what it saw; the policy response is not its call.
   */
  rotate(
    presented: TokenHash,
    successor: RefreshSuccessor,
    now: Date,
  ): Promise<RotationOutcome>;

  revokeSession(sessionId: SessionId, now: Date): Promise<void>;

  /**
   * @param exceptSessionId spared from revocation. Change-password passes the
   * caller's own chain, so choosing a new password does not sign you out of the
   * session you chose it from. Reset passes nothing, because the premise of a
   * reset is that someone else may hold a session.
   */
  revokeAllForUser(
    userId: UserId,
    now: Date,
    exceptSessionId?: SessionId,
  ): Promise<void>;
}
