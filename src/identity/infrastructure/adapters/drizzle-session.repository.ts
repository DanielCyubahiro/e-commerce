import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, ne, type SQL } from 'drizzle-orm';
import {
  type AuthenticatedSession,
  type NewSession,
  type SessionReadModel,
  type SessionRepository,
  sessionAbsoluteCutoff,
  sessionIdleCutoff,
  TOKEN_LIFETIMES,
  type TokenLifetimes,
} from '@/identity/application';
import type { SessionId, TokenHash, UserId } from '@/identity/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import {
  sessions,
  users,
} from '@/shared/infrastructure/database/postgres/schema';

/**
 * Every state transition is one guarded statement. `touch` is the
 * sharpest case: the lookup the guard performs on every request and the
 * idle-window extension are the same UPDATE, so a session can neither be read
 * as live and then fail to be extended, nor be extended after revocation.
 *
 * Takes the lifetimes by constructor rather than reading `ConfigService`, so
 * the integration binding can construct it with plain values; `identity.module.ts`
 * supplies `TOKEN_LIFETIMES` through DI.
 */
@Injectable()
export class DrizzleSessionRepository implements SessionRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(TOKEN_LIFETIMES) private readonly lifetimes: TokenLifetimes,
  ) {}

  async start(session: NewSession, now: Date): Promise<void> {
    await this.db.insert(sessions).values({
      id: session.id.value,
      userId: session.userId.value,
      tokenHash: session.tokenHash.value,
      userAgent: session.origin.userAgent,
      ipAddress: session.origin.ipAddress,
      // Explicit rather than the column defaults, so the row's clock is the
      // caller's `now`, the same clock every later liveness check uses.
      createdAt: now,
      lastSeenAt: now,
    });
  }

  async touch(
    tokenHash: TokenHash,
    now: Date,
  ): Promise<AuthenticatedSession | null> {
    const rows = await this.db
      .update(sessions)
      .set({ lastSeenAt: now })
      .from(users)
      .where(
        and(
          eq(sessions.userId, users.id),
          eq(sessions.tokenHash, tokenHash.value),
          this.live(now),
        ),
      )
      .returning({
        sessionId: sessions.id,
        userId: sessions.userId,
        role: users.role,
      });

    const row = rows[0];

    return row
      ? { userId: row.userId, role: row.role, sessionId: row.sessionId }
      : null;
  }

  async revoke(
    sessionId: SessionId,
    userId: UserId,
    now: Date,
  ): Promise<boolean> {
    const updated = await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.id, sessionId.value),
          // The ownership check. In the predicate rather than in a handler, so
          // another user's session id matches nothing and answers exactly as
          // a nonexistent one does.
          eq(sessions.userId, userId.value),
          this.live(now),
        ),
      )
      .returning({ id: sessions.id });

    return updated.length > 0;
  }

  async revokeAllForUser(
    userId: UserId,
    now: Date,
    exceptSessionId?: SessionId,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.userId, userId.value),
          isNull(sessions.revokedAt),
          // `and` drops undefined, so this is the whole of the optional clause.
          exceptSessionId ? ne(sessions.id, exceptSessionId.value) : undefined,
        ),
      );
  }

  listLiveForUser(userId: UserId, now: Date): Promise<SessionReadModel[]> {
    return this.db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId.value), this.live(now)))
      .orderBy(desc(sessions.lastSeenAt));
  }

  /**
   * The one place liveness is spelled: not revoked, seen within the idle
   * window, created within the absolute one. There is no `expires_at` column
   * to fall out of step with this.
   */
  private live(now: Date): SQL | undefined {
    return and(
      isNull(sessions.revokedAt),
      gt(sessions.lastSeenAt, sessionIdleCutoff(now, this.lifetimes)),
      gt(sessions.createdAt, sessionAbsoluteCutoff(now, this.lifetimes)),
    );
  }
}
