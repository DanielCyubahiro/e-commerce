import type { Page, Pagination } from '@/shared/application';
import type {
  UserFilters,
  UserReadModel,
  UserReadRepository,
} from '@/user/application';
import type { UserId } from '@/user/domain';
import type { InMemoryUserWriteRepository } from './in-memory-user-write.repository';

const EPOCH = Date.parse('2026-01-01T00:00:00.000Z');

/**
 * Reads from whatever the paired write fake holds, applying the same filter,
 * ordering, and paging the Drizzle adapter applies. Constructed from the write
 * fake rather than owning a store, so tests seed through the port they would
 * really use.
 */
export class InMemoryUserReadRepository implements UserReadRepository {
  constructor(private readonly writes: InMemoryUserWriteRepository) {}

  findById(id: UserId): Promise<UserReadModel | null> {
    const found = this.projectAll().find((model) => model.id === id.value);

    return Promise.resolve(found ?? null);
  }

  findMany(
    filters: UserFilters,
    page: Pagination,
  ): Promise<Page<UserReadModel>> {
    const matching = this.projectAll()
      .filter(
        (model) => filters.role === undefined || model.role === filters.role,
      )
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      );

    return Promise.resolve({
      items: matching.slice(page.offset, page.offset + page.limit),
      total: matching.length,
      limit: page.limit,
      offset: page.offset,
    });
  }

  /**
   * The aggregate carries no timestamps and this fake has no column defaults,
   * so the write fake's sequences stand in for the clock: `createdSeq` for
   * `created_at`, `updatedSeq` for `updated_at`. On the adapter a trigger moves
   * `updated_at` on every update, so both order identically.
   */
  private projectAll(): UserReadModel[] {
    return this.writes.stored().map(({ user, createdSeq, updatedSeq }) => ({
      id: user.id.value,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email.value,
      role: user.role.value,
      phone: user.phone?.value ?? null,
      createdAt: new Date(EPOCH + createdSeq * 1000),
      updatedAt: new Date(EPOCH + updatedSeq * 1000),
    }));
  }
}
