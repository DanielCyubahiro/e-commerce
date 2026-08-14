import type {
  ProductFilters,
  ProductReadModel,
  ProductReadRepository,
} from '@/product/application';
import type { ProductId } from '@/product/domain';
import type { Page, Pagination } from '@/shared/application';
import type { InMemoryProductWriteRepository } from './in-memory-product-write.repository';

const EPOCH = Date.parse('2026-01-01T00:00:00.000Z');

/**
 * Reads from whatever the paired write fake holds, applying the same filters,
 * ordering, and paging the Drizzle adapter applies. Constructed from the write
 * fake rather than owning a store, so tests seed through the port they would
 * really use.
 */
export class InMemoryProductReadRepository implements ProductReadRepository {
  constructor(private readonly writes: InMemoryProductWriteRepository) {}

  findById(id: ProductId): Promise<ProductReadModel | null> {
    const found = this.projectAll().find((model) => model.id === id.value);

    return Promise.resolve(found ?? null);
  }

  findMany(
    filters: ProductFilters,
    page: Pagination,
  ): Promise<Page<ProductReadModel>> {
    const matching = this.projectAll()
      .filter(
        (model) =>
          filters.currency === undefined ||
          model.priceCurrency === filters.currency,
      )
      .filter(
        (model) =>
          filters.minPriceMinorUnits === undefined ||
          model.priceMinorUnits >= filters.minPriceMinorUnits,
      )
      .filter(
        (model) =>
          filters.maxPriceMinorUnits === undefined ||
          model.priceMinorUnits <= filters.maxPriceMinorUnits,
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
   * The aggregate no longer carries timestamps and this fake has no column
   * defaults, so insertion order stands in for `created_at`. A Map preserves
   * insertion order, and sequential inserts give the adapter an increasing
   * `now()` for the same reason, so both order identically.
   */
  private projectAll(): ProductReadModel[] {
    return this.writes.snapshot().map((product, index) => {
      const at = new Date(EPOCH + index * 1000);

      return {
        id: product.id.value,
        name: product.name,
        description: product.description,
        priceMinorUnits: product.price.minorUnits,
        priceCurrency: product.price.currency,
        sku: product.sku.value,
        stock: product.stock,
        createdAt: at,
        updatedAt: at,
      };
    });
  }
}
