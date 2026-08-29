import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type {
  AuthenticationRecord,
  CredentialRepository,
} from '@/identity/application';
import { type Email, PasswordHash, type UserId } from '@/identity/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import {
  credentials,
  users,
} from '@/shared/infrastructure/database/postgres/schema';

/**
 * Every write here is a single guarded statement rather than a read followed by
 * a write, so two concurrent callers cannot both pass a check.
 */
@Injectable()
export class DrizzleCredentialRepository implements CredentialRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAuthentication(email: Email): Promise<AuthenticationRecord | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        role: users.role,
        passwordHash: credentials.passwordHash,
        emailVerifiedAt: credentials.emailVerifiedAt,
      })
      .from(users)
      .innerJoin(credentials, eq(credentials.userId, users.id))
      // An inner join, not a left join: a user without a credential cannot log
      // in, and registration writes both in one transaction, so a row missing
      // here is either pre-migration data or a bug. Either way the honest
      // answer to login is the same as an unknown email.
      .where(eq(users.email, email.value))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      role: row.role,
      passwordHash: PasswordHash.create(row.passwordHash),
      emailVerifiedAt: row.emailVerifiedAt,
    };
  }

  async findPasswordHash(userId: UserId): Promise<PasswordHash | null> {
    const rows = await this.db
      .select({ passwordHash: credentials.passwordHash })
      .from(credentials)
      .where(eq(credentials.userId, userId.value))
      .limit(1);

    const row = rows[0];

    return row ? PasswordHash.create(row.passwordHash) : null;
  }

  async markEmailVerified(userId: UserId, now: Date): Promise<boolean> {
    const updated = await this.db
      .update(credentials)
      .set({ emailVerifiedAt: now })
      .where(
        and(
          eq(credentials.userId, userId.value),
          // The guard: already-verified rows do not match, so a replayed link
          // returns false instead of moving the timestamp.
          isNull(credentials.emailVerifiedAt),
        ),
      )
      .returning({ userId: credentials.userId });

    return updated.length > 0;
  }

  async changePassword(userId: UserId, hash: PasswordHash): Promise<boolean> {
    const updated = await this.db
      .update(credentials)
      .set({ passwordHash: hash.value })
      .where(eq(credentials.userId, userId.value))
      .returning({ userId: credentials.userId });

    return updated.length > 0;
  }
}
