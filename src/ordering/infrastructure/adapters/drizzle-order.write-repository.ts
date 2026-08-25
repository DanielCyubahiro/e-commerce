import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  OrderWriteRepository,
  Placement,
  PlaceOutcome,
  SaveOutcome,
} from '@/ordering/application';
import {
  CustomerId,
  Order,
  OrderId,
  OrderLine,
  OrderStatus,
  ShippingAddress,
} from '@/ordering/domain';
import type { Transaction } from '@/shared/application';
import { Money } from '@/shared/domain';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import {
  asDrizzleTransaction,
  type DrizzleExecutor,
} from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import {
  orderLines,
  orders,
} from '@/shared/infrastructure/database/postgres/schema';

const UNIQUE_VIOLATION = '23505';
// The unique index in orders.schema.ts. A fork whose schema tool names it
// anything else still rejects the duplicate; this detection stops recognising
// it, and the client gets a 500 where it should get the original 201.
const IDEMPOTENCY_KEY_UNIQUE = 'orders_customer_id_idempotency_key_unique';

/**
 * The only place a driver error becomes an outcome: everything above this
 * adapter sees only `OrderWriteRepository`'s port contract.
 */
@Injectable()
export class DrizzleOrderWriteRepository implements OrderWriteRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * The inner `transaction` on an existing transaction is a SAVEPOINT. It is
   * what keeps the caller's transaction usable after the unique violation:
   * without it Postgres marks the whole transaction aborted and the outcome
   * could not be returned, only thrown.
   */
  async place(
    { order, idempotencyKey }: Placement,
    tx: Transaction,
  ): Promise<PlaceOutcome> {
    const db = asDrizzleTransaction(tx);

    try {
      await db.transaction(async (savepoint) => {
        await savepoint.insert(orders).values({
          id: order.id.value,
          customerId: order.customerId.value,
          status: order.status.value,
          currency: order.total.currency,
          subtotalAmount: order.subtotal.minorUnits,
          shippingFeeAmount: order.shippingFee.minorUnits,
          taxAmount: order.tax.minorUnits,
          totalAmount: order.total.minorUnits,
          shipRecipientName: order.shippingAddress.recipientName,
          shipLine1: order.shippingAddress.line1,
          shipLine2: order.shippingAddress.line2,
          shipCity: order.shippingAddress.city,
          shipRegion: order.shippingAddress.region,
          shipPostalCode: order.shippingAddress.postalCode,
          shipCountry: order.shippingAddress.country,
          idempotencyKey,
          version: order.version,
          // The four transition timestamps are null at placement, and
          // created_at, updated_at, and number are the database's to assign.
        });

        await savepoint.insert(orderLines).values(
          order.lines.map((line) => ({
            orderId: order.id.value,
            productId: line.productRef.value,
            sku: line.sku,
            name: line.name,
            unitPriceAmount: line.unitPrice.minorUnits,
            quantity: line.quantity.value,
            lineTotalAmount: line.lineTotal.minorUnits,
          })),
        );
      });

      return 'placed';
    } catch (error) {
      if (DrizzleOrderWriteRepository.isDuplicateIdempotencyKey(error)) {
        return 'duplicate-key';
      }
      throw error;
    }
  }

  async findById(id: OrderId): Promise<Order | null> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id.value))
      .limit(1);
    const row = rows[0];

    if (!row) {
      return null;
    }

    const lineRows = await this.db
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, id.value))
      .orderBy(asc(orderLines.productId));

    return Order.reconstitute({
      id,
      customerId: CustomerId.create(row.customerId),
      status: OrderStatus.create(row.status),
      lines: lineRows.map((line) =>
        OrderLine.create({
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          unitPriceMinorUnits: line.unitPriceAmount,
          currency: row.currency,
          quantity: line.quantity,
        }),
      ),
      shippingAddress: ShippingAddress.create({
        recipientName: row.shipRecipientName,
        line1: row.shipLine1,
        line2: row.shipLine2,
        city: row.shipCity,
        region: row.shipRegion,
        postalCode: row.shipPostalCode,
        country: row.shipCountry,
      }),
      subtotal: Money.fromMinorUnits(row.subtotalAmount, row.currency),
      shippingFee: Money.fromMinorUnits(row.shippingFeeAmount, row.currency),
      tax: Money.fromMinorUnits(row.taxAmount, row.currency),
      total: Money.fromMinorUnits(row.totalAmount, row.currency),
      paidAt: row.paidAt,
      shippedAt: row.shippedAt,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt,
      version: row.version,
    });
  }

  /**
   * The version predicate is the whole concurrency story (ADR 0013's guard,
   * applied to an aggregate): a save against a row someone else moved first
   * matches nothing and reports `'conflict'`. `updated_at` is absent on
   * purpose, the orders_set_updated_at trigger owns it (ADR 0009).
   */
  async save(order: Order, tx?: Transaction): Promise<SaveOutcome> {
    const db: DrizzleExecutor = tx ? asDrizzleTransaction(tx) : this.db;

    const updated = await db
      .update(orders)
      .set({
        status: order.status.value,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        version: order.version + 1,
      })
      .where(
        and(eq(orders.id, order.id.value), eq(orders.version, order.version)),
      )
      .returning({ id: orders.id });

    return updated.length > 0 ? 'saved' : 'conflict';
  }

  async findIdByIdempotencyKey(
    customerId: CustomerId,
    key: string,
  ): Promise<OrderId | null> {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, customerId.value),
          eq(orders.idempotencyKey, key),
        ),
      )
      .limit(1);
    const row = rows[0];

    return row ? OrderId.create(row.id) : null;
  }

  /**
   * Walks the cause chain because drizzle wraps driver failures, so the
   * PostgresError carrying `code` and `constraint_name` sits one level down
   * and the depth is not guaranteed. Matches the constraint name as well as
   * the code, so a primary-key collision is never reported as a replay.
   */
  private static isDuplicateIdempotencyKey(error: unknown): boolean {
    let current: unknown = error;

    while (typeof current === 'object' && current !== null) {
      const candidate = current as {
        code?: unknown;
        constraint_name?: unknown;
        cause?: unknown;
      };

      if (
        candidate.code === UNIQUE_VIOLATION &&
        candidate.constraint_name === IDEMPOTENCY_KEY_UNIQUE
      ) {
        return true;
      }

      current = candidate.cause;
    }

    return false;
  }
}
