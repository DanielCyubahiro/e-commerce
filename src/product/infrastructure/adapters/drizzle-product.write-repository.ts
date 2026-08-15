import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DuplicateSkuException,
  type ProductWriteRepository,
} from '@/product/application';
import type { Product, ProductId } from '@/product/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { products } from '@/shared/infrastructure/database/postgres/schema';

const UNIQUE_VIOLATION = '23505';
const SKU_UNIQUE_CONSTRAINT = 'products_sku_unique';

/**
 * The only place a driver error becomes an application exception: everything
 * above this adapter sees only `ProductWriteRepository`'s port contract, never
 * a raw Postgres error.
 */
@Injectable()
export class DrizzleProductWriteRepository implements ProductWriteRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async add(product: Product): Promise<void> {
    try {
      await this.db.insert(products).values({
        id: product.id.value,
        name: product.name,
        description: product.description,
        priceAmount: product.price.minorUnits,
        priceCurrency: product.price.currency,
        sku: product.sku.value,
        stock: product.stock,
      });
    } catch (error) {
      if (DrizzleProductWriteRepository.isDuplicateSku(error)) {
        throw new DuplicateSkuException(product.sku.value);
      }
      throw error;
    }
  }

  async delete(id: ProductId): Promise<boolean> {
    const removed = await this.db
      .delete(products)
      .where(eq(products.id, id.value))
      .returning({ id: products.id });

    return removed.length > 0;
  }

  /**
   * Walks the cause chain because drizzle wraps driver failures in a
   * DrizzleQueryError, so the PostgresError carrying `code` and
   * `constraint_name` sits one level down and the depth is not guaranteed.
   *
   * Matches the constraint name as well as the code, so a primary-key collision
   * on `id` is never reported to a caller as a duplicate SKU.
   */
  private static isDuplicateSku(error: unknown): boolean {
    let current: unknown = error;

    while (typeof current === 'object' && current !== null) {
      const candidate = current as {
        code?: unknown;
        constraint_name?: unknown;
        cause?: unknown;
      };

      if (
        candidate.code === UNIQUE_VIOLATION &&
        candidate.constraint_name === SKU_UNIQUE_CONSTRAINT
      ) {
        return true;
      }

      current = candidate.cause;
    }

    return false;
  }
}
