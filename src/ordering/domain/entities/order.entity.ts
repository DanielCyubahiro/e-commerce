import { AggregateRoot, Money } from '@/shared/domain';
import { InvalidOrderLinesException } from '../exceptions/invalid-order-lines.exception';
import { CustomerId } from '../value-objects/customer-id.vo';
import { OrderId } from '../value-objects/order-id.vo';
import type { OrderLineRequest } from '../value-objects/order-line-request.vo';
import { OrderLine, type OrderLineInput } from '../value-objects/order-line.vo';
import { OrderStatus } from '../value-objects/order-status.vo';
import {
  ShippingAddress,
  type ShippingAddressInput,
} from '../value-objects/shipping-address.vo';

/** Primitives, like `ProductInput`: `lines` are the allocator's snapshots. */
export interface PlaceOrderInput {
  customerId: string;
  lines: OrderLineInput[];
  shippingAddress: ShippingAddressInput;
}

/**
 * Everything the store holds about an order, already as value objects. The
 * persistence factory takes this rather than primitives so value-level
 * invariants re-run on the way back in; only the collection rules are trusted
 * from storage.
 */
export interface OrderState {
  id: OrderId;
  customerId: CustomerId;
  status: OrderStatus;
  lines: OrderLine[];
  shippingAddress: ShippingAddress;
  subtotal: Money;
  shippingFee: Money;
  tax: Money;
  total: Money;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  version: number;
}

/**
 * The consistency boundary for an order. `place` is the only way one comes
 * into being and owns the collection invariants (line count, one line per
 * product, one currency); `reconstitute` is the persistence factory; the four
 * behaviour methods move the status through `OrderStatus.transitionTo`, which
 * owns the table, and stamp their timestamp.
 *
 * `version` is read by the repository's guarded `save` and never changed
 * here: the store increments it, the aggregate only carries what it loaded.
 * `createdAt` and `updatedAt` are not here at all.
 */
export class Order extends AggregateRoot<OrderId> {
  static readonly MIN_LINES = 1;
  static readonly MAX_LINES = 100;

  private readonly _customerId: CustomerId;
  private _status: OrderStatus;
  private readonly _lines: OrderLine[];
  private readonly _shippingAddress: ShippingAddress;
  private readonly _subtotal: Money;
  private readonly _shippingFee: Money;
  private readonly _tax: Money;
  private readonly _total: Money;
  private _paidAt: Date | null;
  private _shippedAt: Date | null;
  private _deliveredAt: Date | null;
  private _cancelledAt: Date | null;
  private readonly _version: number;

  private constructor(state: OrderState) {
    super(state.id);
    this._customerId = state.customerId;
    this._status = state.status;
    this._lines = [...state.lines];
    this._shippingAddress = state.shippingAddress;
    this._subtotal = state.subtotal;
    this._shippingFee = state.shippingFee;
    this._tax = state.tax;
    this._total = state.total;
    this._paidAt = state.paidAt;
    this._shippedAt = state.shippedAt;
    this._deliveredAt = state.deliveredAt;
    this._cancelledAt = state.cancelledAt;
    this._version = state.version;
  }

  /**
   * The collection rules `place` enforces, for a caller that must refuse a
   * request before spending anything on it: the handler runs this before stock
   * is allocated, so an oversized or repeated request locks no rows and answers
   * 422 rather than a shortfall. `place` runs the same private checks again, so
   * each rule still lives in one place.
   *
   * @throws InvalidOrderLinesException for no lines, more than 100, or a repeated product
   */
  static checkLineRequests(requests: readonly OrderLineRequest[]): void {
    Order.validateLineCount(requests.length);
    Order.validateDistinctProductIds(
      requests.map((request) => request.productRef.value),
    );
  }

  /**
   * Validates the count before building a single line, then every line's own
   * rules, then that no product repeats and that one currency prices them
   * all. Fee and tax are zero until a pricing rule supplies them; the columns
   * exist so that rule is additive.
   *
   * @throws InvalidOrderLinesException, and whatever `OrderLine.create` and
   * `ShippingAddress.create` throw
   */
  static place(input: PlaceOrderInput): Order {
    Order.validateLineCount(input.lines.length);

    const lines = input.lines.map((line) => OrderLine.create(line));
    const [first, ...rest] = lines;

    /* istanbul ignore if -- unreachable by construction: validateLineCount rejected an empty list above */
    if (first === undefined) {
      throw InvalidOrderLinesException.empty();
    }

    Order.validateDistinctProductIds(
      lines.map((line) => line.productRef.value),
    );

    const currency = first.unitPrice.currency;
    const mismatched = rest.find(
      (line) => line.unitPrice.currency !== currency,
    );

    if (mismatched) {
      throw InvalidOrderLinesException.mixedCurrencies(
        currency,
        mismatched.unitPrice.currency,
      );
    }

    const subtotal = rest.reduce(
      (sum, line) => sum.add(line.lineTotal),
      first.lineTotal,
    );
    const shippingFee = Money.zero(currency);
    const tax = Money.zero(currency);

    return new Order({
      id: OrderId.create(),
      customerId: CustomerId.create(input.customerId),
      status: OrderStatus.placed(),
      lines,
      shippingAddress: ShippingAddress.create(input.shippingAddress),
      subtotal,
      shippingFee,
      tax,
      total: subtotal.add(shippingFee).add(tax),
      paidAt: null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      version: 1,
    });
  }

  /** The persistence factory. For the write adapter's `findById` and for nothing else. */
  static reconstitute(state: OrderState): Order {
    return new Order(state);
  }

  private static validateLineCount(count: number): void {
    if (count > Order.MAX_LINES) {
      throw InvalidOrderLinesException.tooMany(Order.MAX_LINES);
    }
    if (count < Order.MIN_LINES) {
      throw InvalidOrderLinesException.empty();
    }
  }

  private static validateDistinctProductIds(
    productIds: readonly string[],
  ): void {
    const seen = new Set<string>();

    for (const productId of productIds) {
      if (seen.has(productId)) {
        throw InvalidOrderLinesException.duplicateProduct(productId);
      }
      seen.add(productId);
    }
  }

  /** @throws IllegalOrderTransitionException unless the order is `placed` */
  pay(now: Date): void {
    this._status = this._status.transitionTo(OrderStatus.paid());
    this._paidAt = now;
  }

  /** @throws IllegalOrderTransitionException unless the order is `paid` */
  ship(now: Date): void {
    this._status = this._status.transitionTo(OrderStatus.shipped());
    this._shippedAt = now;
  }

  /** @throws IllegalOrderTransitionException unless the order is `shipped` */
  deliver(now: Date): void {
    this._status = this._status.transitionTo(OrderStatus.delivered());
    this._deliveredAt = now;
  }

  /**
   * Allowed from `placed` and from `paid`; a paid order's refund is an
   * obligation nothing here settles yet. Releasing the allocated stock is the
   * handler's job, using `lines`.
   *
   * @throws IllegalOrderTransitionException once the order has shipped
   */
  cancel(now: Date): void {
    this._status = this._status.transitionTo(OrderStatus.cancelled());
    this._cancelledAt = now;
  }

  isOwnedBy(customerId: CustomerId): boolean {
    return this._customerId.equals(customerId);
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  get status(): OrderStatus {
    return this._status;
  }

  /** A copy: the lines are fixed at placement and no caller may edit them. */
  get lines(): OrderLine[] {
    return [...this._lines];
  }

  get shippingAddress(): ShippingAddress {
    return this._shippingAddress;
  }

  get subtotal(): Money {
    return this._subtotal;
  }

  get shippingFee(): Money {
    return this._shippingFee;
  }

  get tax(): Money {
    return this._tax;
  }

  get total(): Money {
    return this._total;
  }

  get paidAt(): Date | null {
    return this._paidAt;
  }

  get shippedAt(): Date | null {
    return this._shippedAt;
  }

  get deliveredAt(): Date | null {
    return this._deliveredAt;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  /** The version this instance was loaded with (1 for a fresh placement). */
  get version(): number {
    return this._version;
  }
}
