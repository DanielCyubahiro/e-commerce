import { IllegalOrderTransitionException } from '../exceptions/illegal-order-transition.exception';
import { InvalidOrderStatusException } from '../exceptions/invalid-order-status.exception';

// Must stay equal to the order_status pgEnum in orders.schema.ts. Two copies,
// nothing enforcing agreement: a sixth status added here alone compiles and
// fails at insert time. The schema cannot import this list, it lives in the
// shared kernel and must not depend on a bounded context.
const STATUSES = [
  'placed',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type OrderStatusValue = (typeof STATUSES)[number];

// The whole state machine, as data, so the spec can assert every pair rather
// than the ones someone remembered. `delivered` and `cancelled` are terminal.
const TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  placed: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/**
 * Where an order is in its life. `Order`'s four behaviour methods each ask
 * `transitionTo` for permission, so the rule lives here and nowhere else.
 */
export class OrderStatus {
  private constructor(private readonly _value: OrderStatusValue) {}

  /**
   * Trims and lowercases, so `Paid` is accepted and stored as `paid`.
   *
   * @throws InvalidOrderStatusException for anything outside the closed set
   */
  static create(value: string): OrderStatus {
    const normalised = value.trim().toLowerCase();

    if (!OrderStatus.isStatus(normalised)) {
      throw InvalidOrderStatusException.unknown(normalised, STATUSES);
    }

    return new OrderStatus(normalised);
  }

  static placed(): OrderStatus {
    return new OrderStatus('placed');
  }

  static paid(): OrderStatus {
    return new OrderStatus('paid');
  }

  static shipped(): OrderStatus {
    return new OrderStatus('shipped');
  }

  static delivered(): OrderStatus {
    return new OrderStatus('delivered');
  }

  static cancelled(): OrderStatus {
    return new OrderStatus('cancelled');
  }

  /** The closed set, for an exhaustive test or a filter's allowed values. */
  static values(): readonly OrderStatusValue[] {
    return STATUSES;
  }

  /**
   * @returns `next` when the table allows the move
   * @throws IllegalOrderTransitionException otherwise, before any state changes
   */
  transitionTo(next: OrderStatus): OrderStatus {
    if (!TRANSITIONS[this._value].includes(next._value)) {
      throw IllegalOrderTransitionException.notAllowed(
        this._value,
        next._value,
      );
    }

    return next;
  }

  get value(): OrderStatusValue {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof OrderStatus && this._value === other._value;
  }

  private static isStatus(value: string): value is OrderStatusValue {
    return (STATUSES as readonly string[]).includes(value);
  }
}
