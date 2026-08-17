import {
  DuplicateSkuException,
  type ProductWriteRepository,
} from '@/product/application';
import type { Product, ProductId } from '@/product/domain';

/**
 * A fake rather than a mock: a mock asserts how a collaborator was called, which
 * couples tests to call shapes, while this asserts what actually happened. Its
 * fidelity is not taken on trust, the shared contract suite runs against both
 * this and the Drizzle adapter.
 *
 * Methods return promises without being `async` so they reject rather than throw
 * synchronously, which callers awaiting them depend on.
 */
export class InMemoryProductWriteRepository implements ProductWriteRepository {
  private readonly rows = new Map<string, Product>();

  add(product: Product): Promise<void> {
    const skuTaken = [...this.rows.values()].some((stored) =>
      stored.sku.equals(product.sku),
    );

    if (skuTaken) {
      return Promise.reject(new DuplicateSkuException(product.sku.value));
    }

    this.rows.set(product.id.value, product);
    return Promise.resolve();
  }

  replace(product: Product): Promise<boolean> {
    if (!this.rows.has(product.id.value)) {
      return Promise.resolve(false);
    }

    const skuTaken = [...this.rows.values()].some(
      (stored) =>
        stored.sku.equals(product.sku) && !stored.id.equals(product.id),
    );

    if (skuTaken) {
      return Promise.reject(new DuplicateSkuException(product.sku.value));
    }

    // set, never delete-then-set: a Map keeps the original insertion position
    // on overwrite, and the read fake derives created_at ordering from it.
    this.rows.set(product.id.value, product);
    return Promise.resolve(true);
  }

  delete(id: ProductId): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id.value));
  }

  snapshot(): Product[] {
    return [...this.rows.values()];
  }

  clear(): void {
    this.rows.clear();
  }
}
