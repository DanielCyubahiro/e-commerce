import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
import type {
  ProductFilters,
  ProductReadModel,
  ProductReadRepository,
} from '@/product/application';
import type { ProductId } from '@/product/domain';
import type { Page, Pagination } from '@/shared/application';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { products } from '@/shared/infrastructure/database/postgres/schema';

interface ProductRow {
  id: string;
  name: string;
  description: string;
  priceAmount: number;
  priceCurrency: string;
  sku: string;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DrizzleProductReadRepository implements ProductReadRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(id: ProductId): Promise<ProductReadModel | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id.value))
      .limit(1);

    const row = rows[0];

    return row ? DrizzleProductReadRepository.project(row) : null;
  }

  /**
   * `count(*) over()` rides along on the same rows rather than issuing a second
   * COUNT, so the total can never disagree with the page beside it.
   */
  async findMany(
    filters: ProductFilters,
    page: Pagination,
  ): Promise<Page<ProductReadModel>> {
    const conditions = DrizzleProductReadRepository.conditionsFor(filters);

    const rows = await this.db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        priceAmount: products.priceAmount,
        priceCurrency: products.priceCurrency,
        sku: products.sku,
        stock: products.stock,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(page.limit)
      .offset(page.offset);

    return {
      items: rows.map((row) => DrizzleProductReadRepository.project(row)),
      total: await this.totalFor(rows, conditions, page),
      limit: page.limit,
      offset: page.offset,
    };
  }

  /**
   * `count(*) over()` attaches the total to each returned row, so a page past
   * the end has no row to carry it. Only that case needs a second query: an
   * empty page at offset 0 genuinely means zero matches.
   */
  private async totalFor(
    rows: { total: number }[],
    conditions: SQL[],
    page: Pagination,
  ): Promise<number> {
    const first = rows[0];
    if (first) {
      return first.total;
    }
    if (page.offset === 0) {
      return 0;
    }

    const counted = await this.db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return counted[0]?.total ?? 0;
  }

  /** Compares against `undefined`, so a zero bound is a real bound. */
  private static conditionsFor(filters: ProductFilters): SQL[] {
    const conditions: SQL[] = [];

    if (filters.currency !== undefined) {
      conditions.push(eq(products.priceCurrency, filters.currency));
    }
    if (filters.minPriceMinorUnits !== undefined) {
      conditions.push(gte(products.priceAmount, filters.minPriceMinorUnits));
    }
    if (filters.maxPriceMinorUnits !== undefined) {
      conditions.push(lte(products.priceAmount, filters.maxPriceMinorUnits));
    }

    return conditions;
  }

  private static project(row: ProductRow): ProductReadModel {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceMinorUnits: row.priceAmount,
      priceCurrency: row.priceCurrency,
      sku: row.sku,
      stock: row.stock,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
