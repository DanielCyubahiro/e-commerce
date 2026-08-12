import { Inject, Injectable } from '@nestjs/common';
import {
  ProductFilters,
  ProductRepository,
} from '../../application/ports/product.repository';
import { and, eq, gte, lte, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider';
import { Product } from '../../domain/entities/product.entity';
import { products } from '../../../shared/infrastructure/database/postgres/schema';
import { Sku } from '../../domain/value-objects/sku.vo';
import { Money } from '../../../shared/domain/value-objects/money.vo';
import { ProductId } from '../../domain/value-objects/product-id.vo';

@Injectable()
export class DrizzleProductRepository implements ProductRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async save(product: Product): Promise<void> {
    const row = DrizzleProductRepository.toPersistence(product);
    await this.db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: row.name,
          description: row.description,
          priceAmount: row.priceAmount,
          priceCurrency: row.priceCurrency,
          sku: row.sku,
          stock: row.stock,
          lowStockThreshold: row.lowStockThreshold,
          isActive: row.isActive,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: ProductId): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id.value))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return DrizzleProductRepository.toDomain(row);
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.sku, sku.value))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return DrizzleProductRepository.toDomain(row);
  }

  async findMany(filters: ProductFilters): Promise<Product[]> {
    const conditions: SQL[] = [];

    if (filters.minPrice) {
      conditions.push(
        gte(products.priceAmount, Money.create(filters.minPrice).toCents()),
      );
    }

    if (filters.maxPrice) {
      conditions.push(
        lte(products.priceAmount, Money.create(filters.maxPrice).toCents()),
      );
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(products.isActive, filters.isActive));
    }

    const rows = await this.db
      .select()
      .from(products)
      .where(and(...conditions));

    return rows.map((row) => DrizzleProductRepository.toDomain(row));
  }

  async delete(id: ProductId): Promise<boolean> {
    const rows = await this.db
      .delete(products)
      .where(eq(products.id, id.value))
      .returning({ id: products.id });

    return rows.length > 0;
  }

  private static toPersistence(product: Product): typeof products.$inferInsert {
    return {
      id: product.id.value,
      name: product.name,
      description: product.description,
      priceAmount: product.price.toCents(),
      priceCurrency: product.price.currency,
      sku: product.sku.value,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private static toDomain(row: typeof products.$inferSelect): Product {
    return Product.reconstitute({
      id: ProductId.create(row.id),
      name: row.name,
      description: row.description,
      price: Money.create(row.priceAmount / 100, row.priceCurrency),
      sku: Sku.create(row.sku),
      stock: row.stock,
      lowStockThreshold: row.lowStockThreshold,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
