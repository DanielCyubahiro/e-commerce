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
