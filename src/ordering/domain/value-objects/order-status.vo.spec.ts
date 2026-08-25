import { catchError } from '@test/support/catch-error';
import { IllegalOrderTransitionException } from '../exceptions/illegal-order-transition.exception';
import { InvalidOrderStatusException } from '../exceptions/invalid-order-status.exception';
import { OrderStatus, type OrderStatusValue } from './order-status.vo';

const ALLOWED: [OrderStatusValue, OrderStatusValue][] = [
  ['placed', 'paid'],
  ['placed', 'cancelled'],
  ['paid', 'shipped'],
  ['paid', 'cancelled'],
  ['shipped', 'delivered'],
];

// Every pair the table does not allow, derived rather than listed, so a
// status added to the set widens this table automatically.
const FORBIDDEN: [OrderStatusValue, OrderStatusValue][] = OrderStatus.values()
  .flatMap((from) =>
    OrderStatus.values().map((to): [OrderStatusValue, OrderStatusValue] => [
      from,
      to,
    ]),
  )
  .filter(([from, to]) => !ALLOWED.some(([f, t]) => f === from && t === to));

describe('OrderStatus', () => {
  it('normalises case and whitespace on create', () => {
    expect(OrderStatus.create('  Paid ').value).toBe('paid');
  });

  it('rejects a value outside the closed set', () => {
    const error = catchError(
      () => OrderStatus.create('refunded'),
      InvalidOrderStatusException,
    );

    expect(error.code).toBe('ORDER_STATUS_INVALID');
    expect(error.message).toMatch(
      /placed, paid, shipped, delivered, cancelled/,
    );
  });

  it('exposes the five statuses through named factories', () => {
    expect(OrderStatus.placed().value).toBe('placed');
    expect(OrderStatus.paid().value).toBe('paid');
    expect(OrderStatus.shipped().value).toBe('shipped');
    expect(OrderStatus.delivered().value).toBe('delivered');
    expect(OrderStatus.cancelled().value).toBe('cancelled');
  });

  it('has exactly twenty forbidden pairs, so the matrix below is exhaustive', () => {
    expect(FORBIDDEN).toHaveLength(20);
  });

  it.each(ALLOWED)('allows %s to move to %s', (from, to) => {
    expect(
      OrderStatus.create(from).transitionTo(OrderStatus.create(to)).value,
    ).toBe(to);
  });

  it.each(FORBIDDEN)('forbids %s moving to %s', (from, to) => {
    const error = catchError(
      () => OrderStatus.create(from).transitionTo(OrderStatus.create(to)),
      IllegalOrderTransitionException,
    );

    expect(error.code).toBe('ORDER_TRANSITION_ILLEGAL');
    expect(error.kind).toBe('illegal-transition');
    expect(error.message).toMatch(new RegExp(`${from}.*${to}`));
  });

  it('compares by value', () => {
    expect(OrderStatus.paid().equals(OrderStatus.create('PAID'))).toBe(true);
    expect(OrderStatus.paid().equals(OrderStatus.shipped())).toBe(false);
    expect(OrderStatus.paid().equals('paid')).toBe(false);
  });
});
