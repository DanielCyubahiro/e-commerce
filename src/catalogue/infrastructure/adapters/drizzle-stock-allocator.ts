import { Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  type AllocatedLine,
  type AllocationOutcome,
  type AllocationRequest,
  inProductIdOrder,
  type Shortfall,
  type StockAllocator,
} from '@/catalogue/application';
import type { Transaction } from '@/shared/application';
import { asDrizzleTransaction } from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { products } from '@/shared/infrastructure/database/postgres/schema';

/**
 * One guarded `UPDATE ... WHERE stock >= $qty RETURNING ...` per request, on
 * the caller's transaction. Under READ COMMITTED the UPDATE is the lock: a
 * concurrent allocation of the same product blocks on the row, then
 * re-evaluates the guard against the committed stock, so exactly the
 * affordable number of callers ever see a row come back (ADR 0013).
 *
 * Holds no `DRIZZLE` handle of its own: every statement runs on the
 * transaction it is given, or it would not roll back with the order.
 */
@Injectable()
export class DrizzleStockAllocator implements StockAllocator {
  async allocate(
    requests: AllocationRequest[],
    tx: Transaction,
  ): Promise<AllocationOutcome> {
    const db = asDrizzleTransaction(tx);
    const lines: AllocatedLine[] = [];
    const shortfalls: Shortfall[] = [];

    for (const request of inProductIdOrder(requests)) {
      const updated = await db
        .update(products)
        .set({ stock: sql`${products.stock} - ${request.quantity}` })
        .where(
          and(
            eq(products.id, request.productId),
            gte(products.stock, request.quantity),
          ),
        )
        .returning({
          sku: products.sku,
          name: products.name,
          priceAmount: products.priceAmount,
          priceCurrency: products.priceCurrency,
        });

      const row = updated[0];

      if (row) {
        lines.push({
          productId: request.productId,
          sku: row.sku,
          name: row.name,
          unitPriceMinorUnits: row.priceAmount,
          currency: row.priceCurrency,
          quantity: request.quantity,
        });
        continue;
      }

      // Classification only, on the losing path, to say why; it can be
      // marginally stale without harm because nothing about correctness
      // depends on it, the guard above already decided.
      const found = await db
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, request.productId))
        .limit(1);
      const available = found[0]?.stock;

      shortfalls.push(
        available === undefined
          ? { productId: request.productId, reason: 'unknown', available: null }
          : { productId: request.productId, reason: 'insufficient', available },
      );
    }

    return shortfalls.length > 0
      ? { kind: 'rejected', shortfalls }
      : { kind: 'allocated', lines };
  }

  async release(requests: AllocationRequest[], tx: Transaction): Promise<void> {
    const db = asDrizzleTransaction(tx);

    for (const request of inProductIdOrder(requests)) {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} + ${request.quantity}` })
        .where(eq(products.id, request.productId));
    }
  }
}
