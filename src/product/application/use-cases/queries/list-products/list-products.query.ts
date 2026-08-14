import type { Pagination } from '@/shared/application';

/** Price bounds are decimals as a client supplies them, not minor units. */
export class ListProductsQuery {
  constructor(
    public readonly filters: {
      minPrice?: number | undefined;
      maxPrice?: number | undefined;
      currency?: string | undefined;
    },
    public readonly pagination: Pagination,
  ) {}
}
