import type {
  ProductFilters,
  ProductReadModel,
  ProductReadRepository,
} from '@/catalogue/application';
import type { ProductId } from '@/catalogue/domain';
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
   * The aggregate carries no timestamps and this fake has no column defaults,
   * so the write fake's sequences stand in for the clock: `createdSeq` for
   * `created_at`, `updatedSeq` for `updated_at`. Sequential adds give the
   * adapter an increasing `now()` for the same reason, and on the adapter a
   * trigger moves `updated_at` on every update, so both order identically.
   */
  private projectAll(): ProductReadModel[] {
    return this.writes.stored().map(({ product, createdSeq, updatedSeq }) => ({
      id: product.id.value,
      name: product.name,
      description: product.description,
      priceMinorUnits: product.price.minorUnits,
      priceCurrency: product.price.currency,
      sku: product.sku.value,
      stock: product.stock,
      createdAt: new Date(EPOCH + createdSeq * 1000),
      updatedAt: new Date(EPOCH + updatedSeq * 1000),
    }));
  }
}
