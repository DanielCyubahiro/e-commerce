import { catchError } from '@test/support/catch-error';
import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';
import { Quantity } from './quantity.vo';

describe('Quantity', () => {
  it('accepts the bounds inclusively', () => {
    expect(Quantity.create(1).value).toBe(1);
    expect(Quantity.create(999).value).toBe(999);
  });

  it.each([
    [0, /at least 1/],
    [-3, /at least 1/],
    [1000, /at most 999/],
    [1.5, /whole number/],
    [Number.NaN, /whole number/],
  ])('rejects %p', (value, message) => {
    const error = catchError(
      () => Quantity.create(value),
      InvalidQuantityException,
    );

    expect(error.code).toBe('ORDER_QUANTITY_INVALID');
    expect(error.message).toMatch(message);
  });

  it('compares by value', () => {
    expect(Quantity.create(2).equals(Quantity.create(2))).toBe(true);
    expect(Quantity.create(2).equals(Quantity.create(3))).toBe(false);
    expect(Quantity.create(2).equals(2)).toBe(false);
  });
});
