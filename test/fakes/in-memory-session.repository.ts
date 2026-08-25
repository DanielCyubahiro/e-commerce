import {
  type AuthenticatedSession,
  type NewSession,
  type SessionReadModel,
  type SessionRepository,
  sessionAbsoluteCutoff,
  sessionIdleCutoff,
  type TokenLifetimes,
} from '@/identity/application';
import type { SessionId, TokenHash, UserId } from '@/identity/domain';

export interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

/**
 * Keyed by digest, matching the unique index on `token_hash`. Held to the same
 * contract suite as the Drizzle adapter, so the liveness rule cannot drift
 * here. Models no `users` table, so `seedUserRole` stands in for the join
 * `touch` needs to answer with a role.
 */
export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, SessionRow>();
  private readonly roles = new Map<string, string>();

  constructor(private readonly lifetimes: TokenLifetimes) {}

  start(session: NewSession, now: Date): Promise<void> {
    this.store.set(session.tokenHash.value, {
      id: session.id.value,
      userId: session.userId.value,
      tokenHash: session.tokenHash.value,
      userAgent: session.origin.userAgent,
      ipAddress: session.origin.ipAddress,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null,
    });

    return Promise.resolve();
  }

  touch(tokenHash: TokenHash, now: Date): Promise<AuthenticatedSession | null> {
    const row = this.store.get(tokenHash.value);

    if (!row || !this.isLive(row, now)) {
      return Promise.resolve(null);
    }

    const role = this.roles.get(row.userId);

    if (!role) {
      // Unreachable through the binding: the harness always seeds a role
      // before starting a session for that user. The adapter's inner join
      // simply matches nothing without a user row; throwing here keeps a
      // misuse of the fake loud rather than silently answering null. Checked
      // before the touch below, so a throw never leaves the row half-updated.
      throw new Error(`Session owner ${row.userId} has no seeded role.`);
    }

    row.lastSeenAt = now;

    return Promise.resolve({ userId: row.userId, role, sessionId: row.id });
  }

  revoke(sessionId: SessionId, userId: UserId, now: Date): Promise<boolean> {
    const row = [...this.store.values()].find(
      (candidate) => candidate.id === sessionId.value,
    );

    if (!row || row.userId !== userId.value || !this.isLive(row, now)) {
      return Promise.resolve(false);
    }

    row.revokedAt = now;
    return Promise.resolve(true);
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
        row.id !== exceptSessionId?.value
      ) {
        row.revokedAt = now;
      }
    }

    return Promise.resolve();
  }

  listLiveForUser(userId: UserId, now: Date): Promise<SessionReadModel[]> {
    const rows = [...this.store.values()]
      .filter((row) => row.userId === userId.value && this.isLive(row, now))
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((row) => ({
        id: row.id,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
      }));

    return Promise.resolve(rows);
  }

  /** Test seam, not part of the port: stands in for the `users` join. */
  seedUserRole(userId: string, role: string): void {
    this.roles.set(userId, role);
  }

  /** Test seam, not part of the port: every row currently stored, start order. */
  rows(): SessionRow[] {
    return [...this.store.values()];
  }

  clear(): void {
    this.store.clear();
    this.roles.clear();
  }

  // Same three conditions, same strictness, as the adapter's `live`.
  private isLive(row: SessionRow, now: Date): boolean {
    return (
      row.revokedAt === null &&
      row.lastSeenAt > sessionIdleCutoff(now, this.lifetimes) &&
      row.createdAt > sessionAbsoluteCutoff(now, this.lifetimes)
    );
  }
}
