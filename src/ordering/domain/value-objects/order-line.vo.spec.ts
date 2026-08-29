import { InvalidMoneyException } from '@/shared/domain';
import { catchError } from '@test/support/catch-error';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';
import { OrderLine, type OrderLineInput } from './order-line.vo';

const input = (overrides: Partial<OrderLineInput> = {}): OrderLineInput => ({
  productId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  sku: 'ESP-001',
  name: 'Espresso Machine',
  unitPriceMinorUnits: 24999,
  currency: 'EUR',
  quantity: 2,
  ...overrides,
});

describe('OrderLine', () => {
  it('computes the line total as unit price times quantity', () => {
    const line = OrderLine.create(input());

    expect(line.unitPrice.minorUnits).toBe(24999);
    expect(line.lineTotal.minorUnits).toBe(49998);
    expect(line.lineTotal.currency).toBe('EUR');
  });

  it('exposes the product reference and the quantity', () => {
    const line = OrderLine.create(input());

    expect(line.productRef.value).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(line.quantity.value).toBe(2);
  });

  it('trims the snapshot strings but validates nothing else about them', () => {
    const line = OrderLine.create(
      input({ sku: ' esp-001 ', name: ' Espresso ' }),
    );

    // Lowercase sku kept as given: the snapshot records what catalogue held,
    // it does not re-run catalogue's rules.
    expect(line.sku).toBe('esp-001');
    expect(line.name).toBe('Espresso');
  });

  it('re-runs the quantity rule through Quantity', () => {
    expect(
      catchError(
        () => OrderLine.create(input({ quantity: 0 })),
        InvalidQuantityException,
      ).code,
    ).toBe('ORDER_QUANTITY_INVALID');
  });

  it('re-runs the money rules through Money', () => {
    expect(
      catchError(
        () => OrderLine.create(input({ unitPriceMinorUnits: -1 })),
        InvalidMoneyException,
      ).code,
    ).toBe('MONEY_INVALID');
  });

  it('compares by value across every field', () => {
    expect(OrderLine.create(input()).equals(OrderLine.create(input()))).toBe(
      true,
    );
    expect(
      OrderLine.create(input()).equals(
        OrderLine.create(input({ quantity: 3 })),
      ),
    ).toBe(false);
    expect(
      OrderLine.create(input()).equals(
        OrderLine.create(input({ name: 'Other' })),
      ),
    ).toBe(false);
    expect(OrderLine.create(input()).equals(input())).toBe(false);
  });
});
