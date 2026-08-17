import {
  DuplicateSkuException,
  type ProductWriteRepository,
} from '@/product/application';
import type { Product, ProductId } from '@/product/domain';

export interface StoredProduct {
  product: Product;
  /** Assigned once, on `add`; stands in for `created_at`. */
  createdSeq: number;
  /** Bumped by every write to this row; stands in for `updated_at`. */
  updatedSeq: number;
}

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
  private readonly rows = new Map<string, StoredProduct>();
  private writes = 0;

  add(product: Product): Promise<void> {
    const skuTaken = [...this.rows.values()].some((stored) =>
      stored.product.sku.equals(product.sku),
    );

    if (skuTaken) {
      return Promise.reject(new DuplicateSkuException(product.sku.value));
    }

    this.writes += 1;
    this.rows.set(product.id.value, {
      product,
      createdSeq: this.writes,
      updatedSeq: this.writes,
    });
    return Promise.resolve();
  }

  replace(product: Product): Promise<boolean> {
    const existing = this.rows.get(product.id.value);

    if (!existing) {
      return Promise.resolve(false);
    }

    const skuTaken = [...this.rows.values()].some(
      (stored) =>
        stored.product.sku.equals(product.sku) &&
        !stored.product.id.equals(product.id),
    );

    if (skuTaken) {
      return Promise.reject(new DuplicateSkuException(product.sku.value));
    }

    this.writes += 1;
    // set, never delete-then-set: a Map keeps the original insertion position
    // on overwrite, and `createdSeq` is carried over so the row keeps its place
    // in created_at order exactly as the adapter's row does.
    this.rows.set(product.id.value, {
      product,
      createdSeq: existing.createdSeq,
      updatedSeq: this.writes,
    });
    return Promise.resolve(true);
  }

  delete(id: ProductId): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id.value));
  }

  snapshot(): Product[] {
    return [...this.rows.values()].map((stored) => stored.product);
  }

  stored(): StoredProduct[] {
    return [...this.rows.values()];
  }

  clear(): void {
    this.rows.clear();
    this.writes = 0;
  }
}
