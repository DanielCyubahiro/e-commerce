import fc from 'fast-check';
import { catchError } from '@test/support/catch-error';
import { IllegalOrderTransitionException } from '../exceptions/illegal-order-transition.exception';
import { InvalidOrderLinesException } from '../exceptions/invalid-order-lines.exception';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';
import { InvalidShippingAddressException } from '../exceptions/invalid-shipping-address.exception';
import { CustomerId } from '../value-objects/customer-id.vo';
import type { OrderLineInput } from '../value-objects/order-line.vo';
import { Order, type PlaceOrderInput } from './order.entity';

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const PRODUCT_A = '9c858901-8a57-4791-81fe-4c455b099bc9';
const PRODUCT_B = '16fd2706-8baf-433b-82eb-8c7fada847da';
const NOW = new Date('2026-08-25T10:00:00.000Z');

const line = (overrides: Partial<OrderLineInput> = {}): OrderLineInput => ({
  productId: PRODUCT_A,
  sku: 'ESP-001',
  name: 'Espresso Machine',
  unitPriceMinorUnits: 24999,
  currency: 'EUR',
  quantity: 2,
  ...overrides,
});

const input = (overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  customerId: CUSTOMER,
  lines: [
    line(),
    line({
      productId: PRODUCT_B,
      sku: 'KET-1',
      name: 'Kettle',
      unitPriceMinorUnits: 1000,
      quantity: 1,
    }),
  ],
  shippingAddress: {
    recipientName: 'Ada Lovelace',
    line1: '1 Analytical Way',
    city: 'London',
    postalCode: 'N1 1AA',
    country: 'GB',
  },
  ...overrides,
});

describe('Order.place', () => {
  it('mints an identity and starts placed at version 1 with no transition timestamps', () => {
    const order = Order.place(input());

    expect(order.id.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(order.status.value).toBe('placed');
    expect(order.version).toBe(1);
    expect(order.paidAt).toBeNull();
    expect(order.shippedAt).toBeNull();
    expect(order.deliveredAt).toBeNull();
    expect(order.cancelledAt).toBeNull();
  });

  it('records the customer and the address', () => {
    const order = Order.place(input());

    expect(order.customerId.value).toBe(CUSTOMER);
    expect(order.isOwnedBy(CustomerId.create(CUSTOMER))).toBe(true);
    expect(order.isOwnedBy(CustomerId.create())).toBe(false);
    expect(order.shippingAddress.country).toBe('GB');
  });

  it('computes the four totals, with fee and tax held at zero', () => {
    const order = Order.place(input());

    expect(order.subtotal.minorUnits).toBe(49998 + 1000);
    expect(order.shippingFee.minorUnits).toBe(0);
    expect(order.tax.minorUnits).toBe(0);
    expect(order.total.minorUnits).toBe(50998);
    expect(order.total.currency).toBe('EUR');
  });

  it('keeps the lines it was given, as OrderLine value objects', () => {
    const order = Order.place(input());

    expect(order.lines).toHaveLength(2);
    expect(order.lines[0]?.lineTotal.minorUnits).toBe(49998);
    expect(order.lines[1]?.sku).toBe('KET-1');
  });

  it('returns a copy of the lines, so a caller cannot reach in', () => {
    const order = Order.place(input());

    order.lines.pop();

    expect(order.lines).toHaveLength(2);
  });

  it('rejects an order with no lines', () => {
    expect(
      catchError(
        () => Order.place(input({ lines: [] })),
        InvalidOrderLinesException,
      ).message,
    ).toMatch(/at least one/);
  });

  it('rejects more than 100 lines', () => {
    const lines = Array.from({ length: 101 }, (_, i) =>
      line({
        productId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      }),
    );

    expect(
      catchError(
        () => Order.place(input({ lines })),
        InvalidOrderLinesException,
      ).message,
    ).toMatch(/at most 100/);
  });

  it('accepts exactly 100 lines', () => {
    const lines = Array.from({ length: 100 }, (_, i) =>
      line({
        productId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      }),
    );

    expect(Order.place(input({ lines })).lines).toHaveLength(100);
  });

  it('rejects the same product on two lines', () => {
    const error = catchError(
      () => Order.place(input({ lines: [line(), line({ quantity: 1 })] })),
      InvalidOrderLinesException,
    );

    expect(error.code).toBe('ORDER_LINES_INVALID');
    expect(error.message).toMatch(PRODUCT_A);
  });

  it('rejects lines in mixed currencies', () => {
    const error = catchError(
      () =>
        Order.place(
          input({
            lines: [line(), line({ productId: PRODUCT_B, currency: 'USD' })],
          }),
        ),
      InvalidOrderLinesException,
    );

    expect(error.message).toMatch(/USD.*EUR/);
  });

  it('checks the line count before building a single line', () => {
    // 101 lines each carrying an invalid quantity: the count rule fires first,
    // so nothing per-line is ever constructed for a request that is too big.
    const lines = Array.from({ length: 101 }, () => line({ quantity: 0 }));

    expect(
      catchError(
        () => Order.place(input({ lines })),
        InvalidOrderLinesException,
      ).message,
    ).toMatch(/at most 100/);
  });

  it('surfaces a line rule through the line value object', () => {
    expect(
      catchError(
        () => Order.place(input({ lines: [line({ quantity: 0 })] })),
        InvalidQuantityException,
      ).code,
    ).toBe('ORDER_QUANTITY_INVALID');
  });

  it('surfaces an address rule through ShippingAddress', () => {
    expect(
      catchError(
        () =>
          Order.place(
            input({
              shippingAddress: { ...input().shippingAddress, country: 'GBR' },
            }),
          ),
        InvalidShippingAddressException,
      ).code,
    ).toBe('ORDER_SHIPPING_ADDRESS_INVALID');
  });

  it('totals any valid set of lines exactly', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 100 }),
        fc.array(fc.integer({ min: 0, max: 100_000 }), {
          minLength: 100,
          maxLength: 100,
        }),
        fc.array(fc.integer({ min: 1, max: 999 }), {
          minLength: 100,
          maxLength: 100,
        }),
        (productIds, prices, quantities) => {
          const lines = productIds.map((productId, i) =>
            line({
              productId,
              unitPriceMinorUnits: prices[i] ?? 0,
              quantity: quantities[i] ?? 1,
            }),
          );
          const expected = lines.reduce(
            (sum, l) => sum + l.unitPriceMinorUnits * l.quantity,
            0,
          );

          const order = Order.place(input({ lines }));

          expect(order.subtotal.minorUnits).toBe(expected);
          expect(order.total.minorUnits).toBe(expected);
        },
      ),
    );
  });
});

describe('Order transitions', () => {
  const placed = (): Order => Order.place(input());
  const paid = (): Order => {
    const order = placed();
    order.pay(NOW);
    return order;
  };
  const shipped = (): Order => {
    const order = paid();
    order.ship(NOW);
    return order;
  };

  it('pay moves placed to paid and stamps paidAt only', () => {
    const order = paid();

    expect(order.status.value).toBe('paid');
    expect(order.paidAt).toEqual(NOW);
    expect(order.shippedAt).toBeNull();
    expect(order.cancelledAt).toBeNull();
  });

  it('ship moves paid to shipped and stamps shippedAt', () => {
    const order = shipped();

    expect(order.status.value).toBe('shipped');
    expect(order.shippedAt).toEqual(NOW);
  });

  it('deliver moves shipped to delivered and stamps deliveredAt', () => {
    const order = shipped();
    const later = new Date('2026-08-27T10:00:00.000Z');

    order.deliver(later);

    expect(order.status.value).toBe('delivered');
    expect(order.deliveredAt).toEqual(later);
  });

  it('cancel works from placed and from paid, stamping cancelledAt', () => {
    const fromPlaced = placed();
    const fromPaid = paid();

    fromPlaced.cancel(NOW);
    fromPaid.cancel(NOW);

    expect(fromPlaced.status.value).toBe('cancelled');
    expect(fromPaid.status.value).toBe('cancelled');
    expect(fromPaid.cancelledAt).toEqual(NOW);
    expect(fromPaid.paidAt).toEqual(NOW);
  });

  it('an illegal move throws and changes nothing', () => {
    const order = shipped();

    const error = catchError(
      () => order.cancel(NOW),
      IllegalOrderTransitionException,
    );

    expect(error.code).toBe('ORDER_TRANSITION_ILLEGAL');
    expect(order.status.value).toBe('shipped');
    expect(order.cancelledAt).toBeNull();
  });

  it.each([
    ['pay', (order: Order) => order.pay(NOW)],
    ['ship', (order: Order) => order.ship(NOW)],
    ['deliver', (order: Order) => order.deliver(NOW)],
    ['cancel', (order: Order) => order.cancel(NOW)],
  ])('%s is refused on a delivered order', (_name, move) => {
    const order = shipped();
    order.deliver(NOW);

    expect(
      catchError(() => move(order), IllegalOrderTransitionException).kind,
    ).toBe('illegal-transition');
  });

  it('does not change the version; the repository owns that on save', () => {
    const order = paid();

    expect(order.version).toBe(1);
  });
});

describe('Order.reconstitute', () => {
  it('round-trips a transitioned order field for field', () => {
    const original = Order.place(input());
    original.pay(NOW);

    const copy = Order.reconstitute({
      id: original.id,
      customerId: original.customerId,
      status: original.status,
      lines: original.lines,
      shippingAddress: original.shippingAddress,
      subtotal: original.subtotal,
      shippingFee: original.shippingFee,
      tax: original.tax,
      total: original.total,
      paidAt: original.paidAt,
      shippedAt: original.shippedAt,
      deliveredAt: original.deliveredAt,
      cancelledAt: original.cancelledAt,
      version: 7,
    });

    expect(copy.equals(original)).toBe(true);
    expect(copy.status.equals(original.status)).toBe(true);
    expect(copy.paidAt).toEqual(NOW);
    expect(copy.total.equals(original.total)).toBe(true);
    expect(copy.version).toBe(7);
    expect(copy.lines.every((l, i) => l.equals(original.lines[i]))).toBe(true);
  });

  it('continues the state machine from the reconstituted status', () => {
    const original = Order.place(input());
    original.pay(NOW);
    const copy = Order.reconstitute({
      id: original.id,
      customerId: original.customerId,
      status: original.status,
      lines: original.lines,
      shippingAddress: original.shippingAddress,
      subtotal: original.subtotal,
      shippingFee: original.shippingFee,
      tax: original.tax,
      total: original.total,
      paidAt: original.paidAt,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      version: 2,
    });

    copy.ship(NOW);

    expect(copy.status.value).toBe('shipped');
  });
});
