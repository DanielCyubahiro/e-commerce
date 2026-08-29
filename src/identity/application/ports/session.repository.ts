import type { SessionId, TokenHash, UserId } from '@/identity/domain';
import type { SessionReadModel } from '../read-models/session.read-model';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

/**
 * Where a login came from, for the device list. Both `null` when the request
 * carried nothing usable; presentation trims and caps before it gets here.
 */
export interface SessionOrigin {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface NewSession {
  id: SessionId;
  userId: UserId;
  tokenHash: TokenHash;
  origin: SessionOrigin;
}

/**
 * What a live session says about its caller. Primitives rather than `UserId`
 * and `UserRole` because the guard attaches this in the presentation layer,
 * which may not import a domain value object. `role` is read from `users` on
 * every request, so unlike a token claim it is never stale.
 */
export interface AuthenticatedSession {
  userId: string;
  role: string;
  sessionId: string;
}

/**
 * A session is a state machine on three timestamps, not an aggregate: every
 * transition below is one guarded statement, and liveness is
 * computed from `last_seen_at`, `created_at` and the configured lifetimes at
 * query time, never stored. Implementations receive `TokenLifetimes` by
 * constructor so callers pass only `now`.
 */
export interface SessionRepository {
  start(session: NewSession, now: Date): Promise<void>;

  /**
   * The lookup is the touch: one guarded UPDATE that extends the idle window
   * and returns the owner with a live role, or null when no live session holds
   * that digest. Null for unknown, revoked, idle-expired and absolutely
   * expired alike: the guard's only response to all four is 401, and naming
   * which check failed would tell a forger which part to fix.
   */
  touch(tokenHash: TokenHash, now: Date): Promise<AuthenticatedSession | null>;

  /**
   * Scoped to `userId`, so another user's session id is indistinguishable
   * from a nonexistent one. That predicate is the whole ownership check.
   *
   * @returns false when no live session matched, including a second call for
   * a session already revoked or expired.
   */
  revoke(sessionId: SessionId, userId: UserId, now: Date): Promise<boolean>;

  /**
   * @param exceptSessionId spared from revocation. Change-password passes the
   * caller's own session, so choosing a new password does not sign you out of
   * the device you chose it from. Reset passes nothing, because the premise
   * of a reset is that someone else may hold a session.
   */
  revokeAllForUser(
    userId: UserId,
    now: Date,
    exceptSessionId?: SessionId,
  ): Promise<void>;

  /** Live sessions only, most recently seen first. */
  listLiveForUser(userId: UserId, now: Date): Promise<SessionReadModel[]>;
}
