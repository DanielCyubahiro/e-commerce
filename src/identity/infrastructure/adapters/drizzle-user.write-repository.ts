import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DuplicateEmailException,
  type UserWriteRepository,
} from '@/identity/application';
import type { User, UserId } from '@/identity/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { users } from '@/shared/infrastructure/database/postgres/schema';

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

  async add(user: User): Promise<void> {
    try {
      await this.db.insert(users).values({
        id: user.id.value,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email.value,
        role: user.role.value,
        phone: user.phone?.value ?? null,
      });
    } catch (error) {
      if (DrizzleUserWriteRepository.isDuplicateEmail(error)) {
        throw new DuplicateEmailException(user.email.value);
      }
      throw error;
    }
  }

  async replace(user: User): Promise<boolean> {
    try {
      const updated = await this.db
        .update(users)
        .set({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.value,
          role: user.role.value,
          phone: user.phone?.value ?? null,
          // updatedAt is absent deliberately: the users_set_updated_at trigger
          // owns it, so both timestamps come from the database clock. Setting
          // it here would reintroduce the host clock. See ADR 0009.
        })
        .where(eq(users.id, user.id.value))
        .returning({ id: users.id });

      return updated.length > 0;
    } catch (error) {
      if (DrizzleUserWriteRepository.isDuplicateEmail(error)) {
        throw new DuplicateEmailException(user.email.value);
      }
      throw error;
    }
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
