export interface PaginatedResponse<T> {
  items: T[];
  /** Count of matches across the whole query, not just this page. */
  total: number;
  limit: number;
  offset: number;
}
