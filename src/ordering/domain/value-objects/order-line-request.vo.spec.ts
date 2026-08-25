import { InvalidIdentifierException } from '@/shared/domain';
import { catchError } from '@test/support/catch-error';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';
import { OrderLineRequest } from './order-line-request.vo';

const PRODUCT = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('OrderLineRequest', () => {
  it('parses the product reference and the quantity', () => {
    const request = OrderLineRequest.create({
      productId: PRODUCT,
      quantity: 3,
    });

    expect(request.productRef.value).toBe(PRODUCT);
    expect(request.quantity.value).toBe(3);
  });

  it('rejects a malformed product id as an identifier error', () => {
    expect(
      catchError(
        () => OrderLineRequest.create({ productId: 'nope', quantity: 1 }),
        InvalidIdentifierException,
      ).code,
    ).toBe('IDENTIFIER_INVALID');
  });

  it('rejects a non-positive quantity before anything is allocated', () => {
    // The one rule that must run before the allocator: `stock - (-5)` passes
    // a `stock >= qty` guard and adds stock.
    expect(
      catchError(
        () => OrderLineRequest.create({ productId: PRODUCT, quantity: -5 }),
        InvalidQuantityException,
      ).code,
    ).toBe('ORDER_QUANTITY_INVALID');
  });
});
