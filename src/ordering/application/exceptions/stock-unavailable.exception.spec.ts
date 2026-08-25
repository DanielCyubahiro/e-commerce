import type { Shortfall } from '@/catalogue/application';
import { StockUnavailableException } from './stock-unavailable.exception';

const aShortfall = (productId: string): Shortfall => ({
  productId,
  reason: 'insufficient',
  available: 0,
});

describe('StockUnavailableException', () => {
  it('carries the code, kind, and the shortfalls it was given', () => {
    const shortfalls = [aShortfall('product-1')];
    const error = new StockUnavailableException(shortfalls);

    expect(error.code).toBe('ORDER_STOCK_UNAVAILABLE');
    expect(error.kind).toBe('conflict');
    expect(error.details).toEqual(shortfalls);
  });

  it('singularises the count for one shortfall', () => {
    expect(
      new StockUnavailableException([aShortfall('product-1')]).message,
    ).toMatch(/for 1 product\./);
  });

  it('pluralises the count for more than one shortfall', () => {
    expect(
      new StockUnavailableException([
        aShortfall('product-1'),
        aShortfall('product-2'),
      ]).message,
    ).toMatch(/for 2 products\./);
  });
});
