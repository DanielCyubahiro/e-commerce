import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import type {
  IssuedRefreshToken,
  RefreshSuccessor,
  RefreshTokenRepository,
  RotationOutcome,
} from '@/identity/application';
import type { SessionId, TokenHash, UserId } from '@/identity/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import {
  refreshTokens,
  users,
} from '@/shared/infrastructure/database/postgres/schema';

@Injectable()
export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async issue(token: IssuedRefreshToken): Promise<void> {
    await this.db.insert(refreshTokens).values({
      id: token.id.value,
      sessionId: token.sessionId.value,
      userId: token.userId.value,
      tokenHash: token.tokenHash.value,
      expiresAt: token.expiresAt,
    });
  }

  /**
   * The guarded UPDATE is the whole design. A read-then-write here would let two
   * concurrent refreshes both see `used_at IS NULL`, both succeed, and reuse
   * detection would never fire. Exactly one caller can match this predicate.
   *
   * The classification SELECT runs only when the guard matched nothing, and only
   * to choose a message. It can be marginally stale without harm; the consume
   * cannot.
   */
  async rotate(
    presented: TokenHash,
    successor: RefreshSuccessor,
    now: Date,
  ): Promise<RotationOutcome> {
    return this.db.transaction(async (tx) => {
      const consumed = await tx
        .update(refreshTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(refreshTokens.tokenHash, presented.value),
            isNull(refreshTokens.usedAt),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, now),
          ),
        )
        .returning({
          sessionId: refreshTokens.sessionId,
          userId: refreshTokens.userId,
        });

      const won = consumed[0];

      if (won) {
        await tx.insert(refreshTokens).values({
          id: successor.id.value,
          sessionId: won.sessionId,
          userId: won.userId,
          tokenHash: successor.tokenHash.value,
          expiresAt: successor.expiresAt,
        });

        const owner = await tx
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, won.userId))
          .limit(1);

        const role = owner[0]?.role;

        if (!role) {
          // Unreachable while the foreign key cascades: deleting a user deletes
          // their tokens, so a token cannot outlive its owner. Throwing rolls
          // the consume and the successor insert back, which is why this is not
          // an outcome: returning one would commit a rotation whose claims we
          // could not fill in.
          throw new Error(
            `Refresh token ${presented.value.slice(0, 8)} has no owner row.`,
          );
        }

        return {
          outcome: 'rotated',
          userId: won.userId,
          role,
          sessionId: won.sessionId,
        };
      }

      const rows = await tx
        .select({
          sessionId: refreshTokens.sessionId,
          usedAt: refreshTokens.usedAt,
          revokedAt: refreshTokens.revokedAt,
        })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, presented.value))
        .limit(1);

      const row = rows[0];

      if (!row) {
        return { outcome: 'unknown' };
      }

      // Revoked before used: a chain killed by an earlier detection contains
      // tokens that are both, and answering `revoked` stops the handler
      // re-revoking a dead chain on every subsequent attempt.
      if (row.revokedAt !== null) {
        return { outcome: 'revoked' };
      }

      if (row.usedAt !== null) {
        return { outcome: 'replayed', sessionId: row.sessionId };
      }

      return { outcome: 'expired' };
    });
  }

  async revokeSession(sessionId: SessionId, now: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.sessionId, sessionId.value),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  async revokeAllForUser(
    userId: UserId,
    now: Date,
    exceptSessionId?: SessionId,
  ): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.userId, userId.value),
          isNull(refreshTokens.revokedAt),
          // `and` drops undefined, so this is the whole of the optional clause.
          exceptSessionId
            ? ne(refreshTokens.sessionId, exceptSessionId.value)
            : undefined,
        ),
      );
  }
}
