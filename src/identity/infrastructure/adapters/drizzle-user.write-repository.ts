import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DuplicateEmailException,
  type Registration,
  type UserWriteRepository,
} from '@/identity/application';
import type { UserId, UserProfile } from '@/identity/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import {
  credentials,
  oneTimeTokens,
  users,
} from '@/shared/infrastructure/database/postgres/schema';

const UNIQUE_VIOLATION = '23505';
// Drizzle's name for the unnamed .unique() on users.email, as emitted in
// drizzle/0003_users_table.sql. A fork whose schema tool names it anything else
// still rejects the duplicate, but this detection stops recognising it and the
// client gets a 500 where it should get a 409.
const EMAIL_UNIQUE_CONSTRAINT = 'users_email_unique';

/**
 * The only place a driver error becomes an application exception: everything
 * above this adapter sees only `UserWriteRepository`'s port contract, never a
 * raw Postgres error.
 */
@Injectable()
export class DrizzleUserWriteRepository implements UserWriteRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async register(registration: Registration): Promise<void> {
    const { user, passwordHash, verification } = registration;

    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: user.id.value,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          email: user.email.value,
          role: user.role.value,
          phone: user.profile.phone?.value ?? null,
        });

        await tx.insert(credentials).values({
          userId: user.id.value,
          passwordHash: passwordHash.value,
          // emailVerifiedAt is left at NULL: a new account is unverified, and
          // NULL is the only spelling of that. See ADR 0011.
        });

        await tx.insert(oneTimeTokens).values({
          id: verification.id.value,
          purpose: 'email-verification',
          userId: user.id.value,
          tokenHash: verification.tokenHash.value,
          expiresAt: verification.expiresAt,
        });
      });
    } catch (error) {
      if (DrizzleUserWriteRepository.isDuplicateEmail(error)) {
        throw new DuplicateEmailException(user.email.value);
      }
      throw error;
    }
  }

  async replaceProfile(id: UserId, profile: UserProfile): Promise<boolean> {
    // No try/catch and no duplicate-email branch: email is not in the SET list,
    // so this statement cannot raise a unique violation. Role is not in it
    // either, so this statement cannot grant one.
    const updated = await this.db
      .update(users)
      .set({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone?.value ?? null,
        // updatedAt is absent deliberately: the users_set_updated_at trigger
        // owns it, so both timestamps come from the database clock. See ADR 0009.
      })
      .where(eq(users.id, id.value))
      .returning({ id: users.id });

    return updated.length > 0;
  }

  async delete(id: UserId): Promise<boolean> {
    const removed = await this.db
      .delete(users)
      .where(eq(users.id, id.value))
      .returning({ id: users.id });

    return removed.length > 0;
  }

  /**
   * Walks the cause chain because drizzle wraps driver failures in a
   * DrizzleQueryError, so the PostgresError carrying `code` and
   * `constraint_name` sits one level down and the depth is not guaranteed.
   *
   * Matches the constraint name as well as the code, so a primary-key collision
   * on `id` is never reported to a caller as a duplicate email.
   */
  private static isDuplicateEmail(error: unknown): boolean {
    let current: unknown = error;

    while (typeof current === 'object' && current !== null) {
      const candidate = current as {
        code?: unknown;
        constraint_name?: unknown;
        cause?: unknown;
      };

      if (
        candidate.code === UNIQUE_VIOLATION &&
        candidate.constraint_name === EMAIL_UNIQUE_CONSTRAINT
      ) {
        return true;
      }

      current = candidate.cause;
    }

    return false;
  }
}
