import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type {
  ConsumeOutcome,
  IssuedOneTimeToken,
  OneTimeTokenRepository,
} from '@/identity/application';
import type { TokenHash, TokenPurpose } from '@/identity/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { oneTimeTokens } from '@/shared/infrastructure/database/postgres/schema';

@Injectable()
export class DrizzleOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async issue(token: IssuedOneTimeToken): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(oneTimeTokens)
        .where(
          and(
            eq(oneTimeTokens.userId, token.userId.value),
            eq(oneTimeTokens.purpose, token.purpose.value),
            isNull(oneTimeTokens.usedAt),
          ),
        );

      await tx.insert(oneTimeTokens).values({
        id: token.id.value,
        purpose: token.purpose.value,
        userId: token.userId.value,
        tokenHash: token.tokenHash.value,
        expiresAt: token.expiresAt,
      });
    });
  }

  /**
   * Two statements, and the split is deliberate. The first is the guarded
   * consume: it either wins the race and returns a row, or matches nothing. The
   * second runs only on the losing path and exists purely to say *why*, which a
   * caller uses to choose a message. A slightly stale classification there is
   * harmless; a non-atomic consume would not be.
   */
  async consume(
    tokenHash: TokenHash,
    purpose: TokenPurpose,
    now: Date,
  ): Promise<ConsumeOutcome> {
    const consumed = await this.db
      .update(oneTimeTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(oneTimeTokens.tokenHash, tokenHash.value),
          eq(oneTimeTokens.purpose, purpose.value),
          isNull(oneTimeTokens.usedAt),
          gt(oneTimeTokens.expiresAt, now),
        ),
      )
      .returning({ userId: oneTimeTokens.userId });

    const won = consumed[0];

    if (won) {
      return { outcome: 'consumed', userId: won.userId };
    }

    const rows = await this.db
      .select({
        usedAt: oneTimeTokens.usedAt,
        expiresAt: oneTimeTokens.expiresAt,
      })
      .from(oneTimeTokens)
      .where(
        and(
          eq(oneTimeTokens.tokenHash, tokenHash.value),
          eq(oneTimeTokens.purpose, purpose.value),
        ),
      )
      .limit(1);

    const row = rows[0];

    if (!row) {
      return { outcome: 'unknown' };
    }

    // Used is checked before expired: a token that was consumed and has since
    // passed its expiry is a replay, and that is the more useful thing to say.
    return row.usedAt !== null ? { outcome: 'used' } : { outcome: 'expired' };
  }
}
