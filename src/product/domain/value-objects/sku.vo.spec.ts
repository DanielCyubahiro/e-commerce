import { catchError } from '@test/support/catch-error';
import { InvalidSkuException } from '../exceptions/invalid-sku.exception';
import { Sku } from './sku.vo';

describe('Sku', () => {
  it('trims and normalises to uppercase', () => {
    expect(Sku.create('  abc-123  ').value).toBe('ABC-123');
  });

  it('rejects a value shorter than 3 characters', () => {
    expect(catchError(() => Sku.create('ab'), InvalidSkuException).code).toBe(
      'PRODUCT_SKU_INVALID',
    );
  });

  it('rejects characters other than letters, digits, and dashes', () => {
    expect(
      catchError(() => Sku.create('abc_123'), InvalidSkuException).code,
    ).toBe('PRODUCT_SKU_INVALID');
  });
});
