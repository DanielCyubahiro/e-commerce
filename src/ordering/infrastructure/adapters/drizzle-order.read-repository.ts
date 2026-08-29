import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, type SQL, sql } from 'drizzle-orm';
import type {
  OrderDetailReadModel,
  OrderFilters,
  OrderReadRepository,
  OrderSummaryReadModel,
} from '@/ordering/application';
import type { OrderId, OrderStatusValue } from '@/ordering/domain';
import type { Page, Pagination } from '@/shared/application';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import {
  orderLines,
  orders,
} from '@/shared/infrastructure/database/postgres/schema';

interface OrderRow {
  id: string;
  number: number;
  customerId: string;
  status: OrderStatusValue;
  currency: string;
  subtotalAmount: number;
  shippingFeeAmount: number;
  taxAmount: number;
  totalAmount: number;
  shipRecipientName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipRegion: string | null;
  shipPostalCode: string;
  shipCountry: string;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lineCount: number;
}

// Correlated rather than joined so the summary stays one row per order and
// `count(*) over()` below still counts orders, not lines.
const lineCount = sql<number>`(
  select count(*) from ${orderLines}
  where ${orderLines.orderId} = ${orders.id}
)`.mapWith(Number);

const summaryColumns = {
  id: orders.id,
  number: orders.number,
  customerId: orders.customerId,
  status: orders.status,
  currency: orders.currency,
  subtotalAmount: orders.subtotalAmount,
  shippingFeeAmount: orders.shippingFeeAmount,
  taxAmount: orders.taxAmount,
  totalAmount: orders.totalAmount,
  shipRecipientName: orders.shipRecipientName,
  shipLine1: orders.shipLine1,
  shipLine2: orders.shipLine2,
  shipCity: orders.shipCity,
  shipRegion: orders.shipRegion,
  shipPostalCode: orders.shipPostalCode,
  shipCountry: orders.shipCountry,
  paidAt: orders.paidAt,
  shippedAt: orders.shippedAt,
  deliveredAt: orders.deliveredAt,
  cancelledAt: orders.cancelledAt,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
  lineCount,
};

@Injectable()
export class DrizzleOrderReadRepository implements OrderReadRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(
    id: OrderId,
    customerId?: string,
  ): Promise<OrderDetailReadModel | null> {
    const conditions: SQL[] = [eq(orders.id, id.value)];
    if (customerId !== undefined) {
      conditions.push(eq(orders.customerId, customerId));
    }

    const rows = await this.db
      .select(summaryColumns)
      .from(orders)
      .where(and(...conditions))
      .limit(1);
    const row = rows[0];

    if (!row) {
      return null;
    }

    const lines = await this.db
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, row.id))
      .orderBy(asc(orderLines.productId));

    return {
      ...DrizzleOrderReadRepository.summary(row),
      lines: lines.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        unitPriceMinorUnits: line.unitPriceAmount,
        quantity: line.quantity,
        lineTotalMinorUnits: line.lineTotalAmount,
      })),
      shippingAddress: {
        recipientName: row.shipRecipientName,
        line1: row.shipLine1,
        line2: row.shipLine2,
        city: row.shipCity,
        region: row.shipRegion,
        postalCode: row.shipPostalCode,
        country: row.shipCountry,
      },
    };
  }

  /**
   * `count(*) over()` rides along on the same rows rather than issuing a second
   * COUNT, so the total can never disagree with the page beside it.
   */
  async findMany(
    filters: OrderFilters,
    page: Pagination,
  ): Promise<Page<OrderSummaryReadModel>> {
    const conditions = DrizzleOrderReadRepository.conditionsFor(filters);

    const rows = await this.db
      .select({
        ...summaryColumns,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(page.limit)
      .offset(page.offset);

    return {
      items: rows.map((row) => DrizzleOrderReadRepository.summary(row)),
      total: await this.totalFor(rows, conditions, page),
      limit: page.limit,
      offset: page.offset,
    };
  }

  /** Only a page past the end has no row to carry the window total; see the product adapter. */
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
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return counted[0]?.total ?? 0;
  }

  private static conditionsFor(filters: OrderFilters): SQL[] {
    const conditions: SQL[] = [];

    if (filters.status !== undefined) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters.customerId !== undefined) {
      conditions.push(eq(orders.customerId, filters.customerId));
    }

    return conditions;
  }

  /** Renames every `*Amount` column to `*MinorUnits`; nothing else is converted here. */
  private static summary(row: OrderRow): OrderSummaryReadModel {
    return {
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      status: row.status,
      currency: row.currency,
      subtotalMinorUnits: row.subtotalAmount,
      shippingFeeMinorUnits: row.shippingFeeAmount,
      taxMinorUnits: row.taxAmount,
      totalMinorUnits: row.totalAmount,
      lineCount: row.lineCount,
      paidAt: row.paidAt,
      shippedAt: row.shippedAt,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
