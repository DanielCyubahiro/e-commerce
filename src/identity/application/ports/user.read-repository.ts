import type { Page, Pagination } from '@/shared/application';
import type { UserId } from '@/identity/domain';
import type { UserReadModel } from '../read-models/user.read-model';

/**
 * `role` is the raw stored string, not a `UserRole`: no implementation should
 * have to import the domain to answer a query. `ListUsersHandler` is what
 * parses the caller's value through `UserRole.create` before it reaches here,
 * so an unknown role never becomes a silently empty page.
 */
export interface UserFilters {
  role?: string | undefined;
}

export const USER_READ_REPOSITORY = Symbol('USER_READ_REPOSITORY');

export interface UserReadRepository {
  /**
   * @returns null when no user holds that id. Turning that absence into
   * `UserNotFoundException` is the handler's job, not this port's.
   */
  findById(id: UserId): Promise<UserReadModel | null>;

  /** Newest first, ordered by `created_at DESC, id DESC` so paging is total. */
  findMany(
    filters: UserFilters,
    page: Pagination,
  ): Promise<Page<UserReadModel>>;
}
