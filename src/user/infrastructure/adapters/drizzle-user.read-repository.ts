import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, type SQL, sql } from 'drizzle-orm';
import type {
  UserFilters,
  UserReadModel,
  UserReadRepository,
} from '@/user/application';
import type { UserId } from '@/user/domain';
import type { Page, Pagination } from '@/shared/application';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { users } from '@/shared/infrastructure/database/postgres/schema';

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DrizzleUserReadRepository implements UserReadRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(id: UserId): Promise<UserReadModel | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id.value))
      .limit(1);

    const row = rows[0];

    return row ? DrizzleUserReadRepository.project(row) : null;
  }

  /**
   * `count(*) over()` rides along on the same rows rather than issuing a second
   * COUNT, so the total can never disagree with the page beside it.
   */
  async findMany(
    filters: UserFilters,
    page: Pagination,
  ): Promise<Page<UserReadModel>> {
    const conditions = DrizzleUserReadRepository.conditionsFor(filters);

    const rows = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        phone: users.phone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(page.limit)
      .offset(page.offset);

    return {
      items: rows.map((row) => DrizzleUserReadRepository.project(row)),
      total: await this.totalFor(rows, conditions, page),
      limit: page.limit,
      offset: page.offset,
    };
  }

  /**
   * `count(*) over()` attaches the total to each returned row, so a page past
   * the end has no row to carry it. Only that case needs a second query: an
   * empty page at offset 0 genuinely means zero matches.
   */
  private async totalFor(
    rows: { total: number }[],
    conditions: SQL[],
    page: Pagination,
  ): Promise<number> {
    const first = rows[0];
    if (first) {
      return first.total;
    }
    if (page.offset === 0) {
      return 0;
    }

    const counted = await this.db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return counted[0]?.total ?? 0;
  }

  private static conditionsFor(filters: UserFilters): SQL[] {
    const conditions: SQL[] = [];

    if (filters.role !== undefined) {
      // Already parsed through UserRole by ListUsersHandler, so the cast is
      // safe: nothing outside the enum reaches here.
      conditions.push(eq(users.role, filters.role as 'customer' | 'seller'));
    }

    return conditions;
  }

  /** Absence stays `null` here; see ADR 0011. */
  private static project(row: UserRow): UserReadModel {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role,
      phone: row.phone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
