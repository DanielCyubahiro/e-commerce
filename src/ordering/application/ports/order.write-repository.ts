import type { CustomerId, Order, OrderId } from '@/ordering/domain';
import type { Transaction } from '@/shared/application';

export const ORDER_WRITE_REPOSITORY = Symbol('ORDER_WRITE_REPOSITORY');

/**
 * The key rides beside the aggregate, not inside it: it says how a request was
 * delivered, nothing about what an order is. `null` means the client sent none.
 */
export interface Placement {
  order: Order;
  idempotencyKey: string | null;
}

/**
 * Closed unions a handler narrows on. `'duplicate-key'` means another order of
 * the same customer already holds this key; `'conflict'` means the row's
 * version moved since this aggregate was loaded.
 */
export type PlaceOutcome = 'placed' | 'duplicate-key';
export type SaveOutcome = 'saved' | 'conflict';

export interface OrderWriteRepository {
  /**
   * Inserts the order and its lines on the caller's transaction. A unique
   * violation on `(customer_id, idempotency_key)` is an outcome, never an
   * exception, and leaves the caller's transaction usable; the caller decides
   * whether to roll back (it will, since the allocation preceding this must be
   * undone).
   */
  place(placement: Placement, tx: Transaction): Promise<PlaceOutcome>;

  /** Reconstitutes the aggregate, lines included. `null` when nothing holds the id. */
  findById(id: OrderId): Promise<Order | null>;

  /**
   * One guarded statement: writes status and the four transition timestamps
   * where the stored version equals `order.version`, and increments it. Lines
   * are immutable after placement, so nothing else is written. `tx` is
   * optional because pay, ship, and deliver are single statements; cancel
   * passes one so the stock release commits with it.
   */
  save(order: Order, tx?: Transaction): Promise<SaveOutcome>;

  /** The id of this customer's order placed under `key`, or `null`. */
  findIdByIdempotencyKey(
    customerId: CustomerId,
    key: string,
  ): Promise<OrderId | null>;
}
