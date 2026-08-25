import {
  type AllocatedLine,
  type AllocationOutcome,
  type AllocationRequest,
  inProductIdOrder,
  type Shortfall,
  type StockAllocator,
} from '@/catalogue/application';
import { Product } from '@/catalogue/domain';
import type { InMemoryProductWriteRepository } from './in-memory-product-write.repository';

/**
 * Decrements through the product write fake's own `replace`, so the fake
 * read repository sees the new stock and `updated_at` moves the way the
 * trigger moves it. Takes part in `FakeUnitOfWork` through the product fake
 * it writes to, so a rolled-back allocation is undone there.
 *
 * Neither method declares the `tx` parameter `StockAllocator` requires: this
 * fake has no transaction handle of its own to run statements on, and
 * TypeScript allows an implementation to accept fewer parameters than the
 * interface it satisfies.
 */
export class InMemoryStockAllocator implements StockAllocator {
  constructor(private readonly products: InMemoryProductWriteRepository) {}

  async allocate(requests: AllocationRequest[]): Promise<AllocationOutcome> {
    const lines: AllocatedLine[] = [];
    const shortfalls: Shortfall[] = [];

    for (const request of inProductIdOrder(requests)) {
      const product = this.find(request.productId);

      if (!product) {
        shortfalls.push({
          productId: request.productId,
          reason: 'unknown',
          available: null,
        });
        continue;
      }

      if (product.stock < request.quantity) {
        shortfalls.push({
          productId: request.productId,
          reason: 'insufficient',
          available: product.stock,
        });
        continue;
      }

      await this.products.replace(
        InMemoryStockAllocator.withStock(
          product,
          product.stock - request.quantity,
        ),
      );
      lines.push({
        productId: request.productId,
        sku: product.sku.value,
        name: product.name,
        unitPriceMinorUnits: product.price.minorUnits,
        currency: product.price.currency,
        quantity: request.quantity,
      });
    }

    return shortfalls.length > 0
      ? { kind: 'rejected', shortfalls }
      : { kind: 'allocated', lines };
  }

  async release(requests: AllocationRequest[]): Promise<void> {
    for (const request of inProductIdOrder(requests)) {
      const product = this.find(request.productId);

      if (product) {
        await this.products.replace(
          InMemoryStockAllocator.withStock(
            product,
            product.stock + request.quantity,
          ),
        );
      }
    }
  }

  private find(productId: string): Product | undefined {
    return this.products.snapshot().find((p) => p.id.value === productId);
  }

  private static withStock(product: Product, stock: number): Product {
    return Product.replace(product.id, {
      name: product.name,
      description: product.description,
      price: product.price.amount,
      currency: product.price.currency,
      sku: product.sku.value,
      stock,
    });
  }
}
