import { Product } from '@/catalogue/domain';
import type { InMemoryProductWriteRepository } from './in-memory-product-write.repository';

/**
 * What an ordering spec may know about a seeded product: its id, to put on a
 * line, and its current stock, to assert an allocation or a release. Nothing
 * else about catalogue's aggregate crosses into ordering's tests.
 */
export interface SeededProduct {
  readonly id: string;
  stock(): number;
}

/** Builds a product with sensible defaults, stores it in the fake, and returns the narrow handle. */
export async function seedProduct(
  products: InMemoryProductWriteRepository,
  overrides: {
    sku: string;
    stock: number;
    price?: number;
    name?: string;
    currency?: string;
  },
): Promise<SeededProduct> {
  const product = Product.create({
    name: overrides.name ?? `Product ${overrides.sku}`,
    description: 'Seeded for an ordering spec.',
    price: overrides.price ?? 10,
    currency: overrides.currency ?? 'EUR',
    sku: overrides.sku,
    stock: overrides.stock,
  });
  await products.add(product);

  return {
    id: product.id.value,
    stock: () =>
      products.snapshot().find((p) => p.id.equals(product.id))?.stock ?? -1,
  };
}
