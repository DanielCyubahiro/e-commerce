/** Offset-based. `limit` is already bounded by the DTO, never by the adapter. */
export interface Pagination {
  limit: number;
  offset: number;
}

/** `total` counts every row matching the filter, not the page. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
