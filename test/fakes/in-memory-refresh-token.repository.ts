import type {
  IssuedRefreshToken,
  RefreshSuccessor,
  RefreshTokenRepository,
  RotationOutcome,
} from '@/identity/application';
import type { SessionId, TokenHash, UserId } from '@/identity/domain';

interface Row {
  id: string;
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Keyed by digest, matching the unique index on `token_hash`. Held to the
 * same contract suite as the Drizzle adapter, so a divergence in branch order
 * cannot hide here. Models no `users` table, so `seedUserRole` stands in for
 * the join `rotate` needs to answer with a role.
 */
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly store = new Map<string, Row>();
  private readonly roles = new Map<string, string>();

  issue(token: IssuedRefreshToken): Promise<void> {
    this.store.set(token.tokenHash.value, {
      id: token.id.value,
      sessionId: token.sessionId.value,
      userId: token.userId.value,
      tokenHash: token.tokenHash.value,
      expiresAt: token.expiresAt,
      usedAt: null,
      revokedAt: null,
    });

    return Promise.resolve();
  }

  rotate(
    presented: TokenHash,
    successor: RefreshSuccessor,
    now: Date,
  ): Promise<RotationOutcome> {
    const row = this.store.get(presented.value);

    if (!row) {
      return Promise.resolve({ outcome: 'unknown' });
    }

    // Same branch order as the adapter's post-guard classification: revoked
    // before used, so a chain killed by an earlier detection answers
    // `revoked` even for a token that was also used.
    if (row.revokedAt !== null) {
      return Promise.resolve({ outcome: 'revoked' });
    }

    if (row.usedAt !== null) {
      return Promise.resolve({
        outcome: 'replayed',
        sessionId: row.sessionId,
      });
    }

    if (row.expiresAt <= now) {
      return Promise.resolve({ outcome: 'expired' });
    }

    row.usedAt = now;
    this.store.set(successor.tokenHash.value, {
      id: successor.id.value,
      sessionId: row.sessionId,
      userId: row.userId,
      tokenHash: successor.tokenHash.value,
      expiresAt: successor.expiresAt,
      usedAt: null,
      revokedAt: null,
    });

    const role = this.roles.get(row.userId);

    if (!role) {
      // Unreachable through the binding: the harness always seeds a role
      // before issuing a token for that user. Kept as a throw, matching the
      // adapter, rather than returning an outcome that would commit a
      // rotation whose claims could not be filled in.
      throw new Error(`Refresh token owner ${row.userId} has no seeded role.`);
    }

    return Promise.resolve({
      outcome: 'rotated',
      userId: row.userId,
      role,
      sessionId: row.sessionId,
    });
  }

  revokeSession(sessionId: SessionId, now: Date): Promise<void> {
    for (const row of this.store.values()) {
      if (row.sessionId === sessionId.value && row.revokedAt === null) {
        row.revokedAt = now;
      }
    }

    return Promise.resolve();
  }

  revokeAllForUser(
    userId: UserId,
    now: Date,
    exceptSessionId?: SessionId,
  ): Promise<void> {
    for (const row of this.store.values()) {
      if (
        row.userId === userId.value &&
        row.revokedAt === null &&
        row.sessionId !== exceptSessionId?.value
      ) {
        row.revokedAt = now;
      }
    }

    return Promise.resolve();
  }

  /** Test seam, not part of the port: stands in for the `users` join. */
  seedUserRole(userId: string, role: string): void {
    this.roles.set(userId, role);
  }

  /** Test seam, not part of the port: every digest currently stored, issue order. */
  digests(): string[] {
    return [...this.store.keys()];
  }

  /** Test seam, not part of the port: every row currently stored, issue order. */
  rows(): Row[] {
    return [...this.store.values()];
  }

  clear(): void {
    this.store.clear();
    this.roles.clear();
  }
}
