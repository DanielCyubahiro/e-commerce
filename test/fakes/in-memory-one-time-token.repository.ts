import type {
  ConsumeOutcome,
  IssuedOneTimeToken,
  OneTimeTokenRepository,
} from '@/identity/application';
import type { TokenHash, TokenPurpose } from '@/identity/domain';

interface Row {
  id: string;
  purpose: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Keyed by digest, matching the unique index on `token_hash`. Held to the same
 * contract suite as the Drizzle adapter, so a divergence in branch order cannot
 * hide here.
 */
export class InMemoryOneTimeTokenRepository implements OneTimeTokenRepository {
  private readonly rows = new Map<string, Row>();

  issue(token: IssuedOneTimeToken): Promise<void> {
    for (const [digest, row] of this.rows) {
      if (
        row.userId === token.userId.value &&
        row.purpose === token.purpose.value &&
        row.usedAt === null
      ) {
        this.rows.delete(digest);
      }
    }

    this.rows.set(token.tokenHash.value, {
      id: token.id.value,
      purpose: token.purpose.value,
      userId: token.userId.value,
      tokenHash: token.tokenHash.value,
      expiresAt: token.expiresAt,
      usedAt: null,
    });

    return Promise.resolve();
  }

  consume(
    tokenHash: TokenHash,
    purpose: TokenPurpose,
    now: Date,
  ): Promise<ConsumeOutcome> {
    const row = this.rows.get(tokenHash.value);

    if (!row || row.purpose !== purpose.value) {
      return Promise.resolve({ outcome: 'unknown' });
    }

    if (row.usedAt !== null) {
      return Promise.resolve({ outcome: 'used' });
    }

    if (row.expiresAt <= now) {
      return Promise.resolve({ outcome: 'expired' });
    }

    row.usedAt = now;
    return Promise.resolve({ outcome: 'consumed', userId: row.userId });
  }

  clear(): void {
    this.rows.clear();
  }
}
