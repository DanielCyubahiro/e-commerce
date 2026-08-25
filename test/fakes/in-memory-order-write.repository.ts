import type {
  OrderWriteRepository,
  Placement,
  PlaceOutcome,
  SaveOutcome,
} from '@/ordering/application';
import { type CustomerId, Order, type OrderId } from '@/ordering/domain';
import type { Snapshottable } from './snapshottable';

export interface StoredOrder {
  order: Order;
  idempotencyKey: string | null;
  /** Stands in for the identity column: assigned once, increasing. */
  number: number;
  /** Assigned once, on `place`; stands in for `created_at`. */
  createdSeq: number;
  /** Bumped by every write to this row; stands in for `updated_at`. */
  updatedSeq: number;
}

/**
 * Stores a reconstituted copy on every write and hands out a fresh copy on
 * every read, so two loads of one order are two instances exactly as they are
 * from Postgres; that is what makes the stale-version conflict reproducible
 * here. Held to the same contract suite as the Drizzle adapter.
 *
 * Methods return promises without being `async` so they reject rather than
 * throw synchronously, which callers awaiting them depend on.
 *
 * Neither `place` nor `save` declares the `tx` parameter the port requires:
 * this fake has no transaction handle of its own to run statements on, and
 * TypeScript allows an implementation to accept fewer parameters than the
 * interface it satisfies.
 */
export class InMemoryOrderWriteRepository
  implements OrderWriteRepository, Snapshottable
{
  private readonly rows = new Map<string, StoredOrder>();
  private writes = 0;
  private nextNumber = 1;

  place({ order, idempotencyKey }: Placement): Promise<PlaceOutcome> {
    if (
      idempotencyKey !== null &&
      [...this.rows.values()].some(
        (row) =>
          row.idempotencyKey === idempotencyKey &&
          row.order.customerId.equals(order.customerId),
      )
    ) {
      return Promise.resolve('duplicate-key');
    }

    this.writes += 1;
    this.rows.set(order.id.value, {
      order: InMemoryOrderWriteRepository.copy(order),
      idempotencyKey,
      number: this.nextNumber,
      createdSeq: this.writes,
      updatedSeq: this.writes,
    });
    this.nextNumber += 1;
    return Promise.resolve('placed');
  }

  findById(id: OrderId): Promise<Order | null> {
    const row = this.rows.get(id.value);

    return Promise.resolve(
      row ? InMemoryOrderWriteRepository.copy(row.order) : null,
    );
  }

  save(order: Order): Promise<SaveOutcome> {
    const row = this.rows.get(order.id.value);

    if (!row || row.order.version !== order.version) {
      return Promise.resolve('conflict');
    }

    this.writes += 1;
    this.rows.set(order.id.value, {
      ...row,
      order: InMemoryOrderWriteRepository.copy(order, order.version + 1),
      updatedSeq: this.writes,
    });
    return Promise.resolve('saved');
  }

  findIdByIdempotencyKey(
    customerId: CustomerId,
    key: string,
  ): Promise<OrderId | null> {
    const row = [...this.rows.values()].find(
      (stored) =>
        stored.idempotencyKey === key &&
        stored.order.customerId.equals(customerId),
    );

    return Promise.resolve(row ? row.order.id : null);
  }

  /** Test seam for the read fake and for handler specs. */
  stored(): StoredOrder[] {
    return [...this.rows.values()];
  }

  clear(): void {
    this.rows.clear();
    this.writes = 0;
    this.nextNumber = 1;
  }

  capture(): unknown {
    return {
      rows: new Map(
        [...this.rows].map(([id, stored]) => [id, { ...stored }] as const),
      ),
      writes: this.writes,
      nextNumber: this.nextNumber,
    };
  }

  restore(captured: unknown): void {
    const { rows, writes, nextNumber } = captured as {
      rows: Map<string, StoredOrder>;
      writes: number;
      nextNumber: number;
    };

    this.rows.clear();
    for (const [id, stored] of rows) {
      this.rows.set(id, { ...stored });
    }
    this.writes = writes;
    this.nextNumber = nextNumber;
  }

  /** Value objects are immutable, so sharing them between copies is safe. */
  private static copy(order: Order, version = order.version): Order {
    return Order.reconstitute({
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      lines: order.lines,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      tax: order.tax,
      total: order.total,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      version,
    });
  }
}
