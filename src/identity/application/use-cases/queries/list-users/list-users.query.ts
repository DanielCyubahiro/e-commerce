import type { Pagination } from '@/shared/application';

/**
 * `role` is the caller's raw string. Parsing it through the domain is
 * `ListUsersHandler`'s job, not this query's.
 */
export interface ListUsersFilters {
  role?: string | undefined;
}

export class ListUsersQuery {
  constructor(
    public readonly filters: ListUsersFilters,
    public readonly pagination: Pagination,
  ) {}
}
