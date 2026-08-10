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
    const productData = DrizzleProductRepository.toPersistence(product);
    await this.db
      .insert(products)
      .values(productData)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: productData.name,
          description: productData.description,
          priceAmount: productData.priceAmount,
          priceCurrency: productData.priceCurrency,
          sku: productData.sku,
          stock: productData.stock,
          lowStockThreshold: productData.lowStockThreshold,
          isActive: productData.isActive,
          updatedAt: productData.updatedAt,
        },
      });
  }

  async findById(id: ProductId): Promise<Product | null> {
    const productData = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id.getValue()))
      .limit(1);

    if (productData.length === 0) {
      return null;
    }

    return DrizzleProductRepository.toDomain(productData[0]);
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    const productData = await this.db
      .select()
      .from(products)
      .where(eq(products.sku, sku.getValue()))
      .limit(1);

    if (productData.length === 0) {
      return null;
    }

    return DrizzleProductRepository.toDomain(productData[0]);
  }

  async findAll(productFilters: ProductFilters): Promise<Product[]> {
    const conditions: SQL[] = [];

    if (productFilters.minPrice) {
      conditions.push(
        gte(
          products.priceAmount,
          Money.create(productFilters.minPrice).toCent(),
        ),
      );
    }

    if (productFilters.maxPrice) {
      conditions.push(
        lte(
          products.priceAmount,
          Money.create(productFilters.maxPrice).toCent(),
        ),
      );
    }

    if (productFilters.isActive !== undefined) {
      conditions.push(eq(products.isActive, productFilters.isActive));
    }

    const productDataList = await this.db
      .select()
      .from(products)
      .where(and(...conditions));

    return productDataList.map((productData) =>
      DrizzleProductRepository.toDomain(productData),
    );
  }

  private static toPersistence(product: Product): typeof products.$inferInsert {
    return {
      id: product.id.getValue(),
      name: product.name,
      description: product.description,
      priceAmount: product.price.toCent(),
      priceCurrency: product.price.getCurrency(),
      sku: product.sku.getValue(),
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private static toDomain(productData: typeof products.$inferSelect): Product {
    return Product.reconstitute({
      id: new ProductId(productData.id),
      name: productData.name,
      description: productData.description,
      price: Money.create(
        productData.priceAmount / 100,
        productData.priceCurrency,
      ),
      sku: Sku.create(productData.sku),
      stock: productData.stock,
      lowStockThreshold: productData.lowStockThreshold,
      isActive: productData.isActive,
      createdAt: productData.createdAt,
      updatedAt: productData.updatedAt,
    });
  }
}
