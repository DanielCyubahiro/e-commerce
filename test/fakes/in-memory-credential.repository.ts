import type {
  AuthenticationRecord,
  CredentialRepository,
} from '@/identity/application';
import { type Email, PasswordHash, type UserId } from '@/identity/domain';

interface Row {
  userId: string;
  email: string;
  role: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
}

/**
 * Holds the joined shape rather than two tables, because nothing in the port's
 * contract distinguishes them. Held to the same contract suite as the Drizzle
 * adapter, so the simplification cannot hide a behavioural difference.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly rows = new Map<string, Row>();

  /** Test seam, not part of the port. */
  seed(row: Row): void {
    this.rows.set(row.userId, row);
  }

  findAuthentication(email: Email): Promise<AuthenticationRecord | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.email === email.value,
    );

    return Promise.resolve(
      row
        ? {
            userId: row.userId,
            role: row.role,
            passwordHash: PasswordHash.create(row.passwordHash),
            emailVerifiedAt: row.emailVerifiedAt,
          }
        : null,
    );
  }

  findPasswordHash(userId: UserId): Promise<PasswordHash | null> {
    const row = this.rows.get(userId.value);

    return Promise.resolve(row ? PasswordHash.create(row.passwordHash) : null);
  }

  markEmailVerified(userId: UserId, now: Date): Promise<boolean> {
    const row = this.rows.get(userId.value);

    if (!row || row.emailVerifiedAt !== null) {
      return Promise.resolve(false);
    }

    this.rows.set(userId.value, { ...row, emailVerifiedAt: now });
    return Promise.resolve(true);
  }

  changePassword(userId: UserId, hash: PasswordHash): Promise<boolean> {
    const row = this.rows.get(userId.value);

    if (!row) {
      return Promise.resolve(false);
    }

    this.rows.set(userId.value, { ...row, passwordHash: hash.value });
    return Promise.resolve(true);
  }

  clear(): void {
    this.rows.clear();
  }
}
