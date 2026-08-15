import type { ProductId } from '@/product/domain';
import type { Page, Pagination } from '@/shared/application';
import type { ProductReadModel } from '../read-models/product.read-model';

export const PRODUCT_READ_REPOSITORY = Symbol('PRODUCT_READ_REPOSITORY');

/**
 * Bounds are in minor units, matching the stored column, so no implementation
 * has to know how a decimal becomes an integer. `ListProductsHandler` converts.
 *
 * A price bound only means something within one currency, so `currency` is
 * required whenever either bound is set.
 */
export interface ProductFilters {
  minPriceMinorUnits?: number | undefined;
  maxPriceMinorUnits?: number | undefined;
  currency?: string | undefined;
}

export interface ProductReadRepository {
  /**
   * @returns null when no product holds that id. Turning that absence into
   * `ProductNotFoundException` is the handler's job, not this port's.
   */
  findById(id: ProductId): Promise<ProductReadModel | null>;

  /** Newest first, ordered by `created_at DESC, id DESC` so paging is total. */
  findMany(
    filters: ProductFilters,
    page: Pagination,
  ): Promise<Page<ProductReadModel>>;
}
