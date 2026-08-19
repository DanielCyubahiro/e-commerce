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

  it('rejects a value longer than 50 characters', () => {
    expect(
      catchError(() => Sku.create('A'.repeat(51)), InvalidSkuException).code,
    ).toBe('PRODUCT_SKU_INVALID');
  });

  it('accepts exactly 50 characters', () => {
    expect(Sku.create('A'.repeat(50)).value).toHaveLength(50);
  });

  describe('equals', () => {
    it('is true for the same normalised value', () => {
      expect(Sku.create('abc-1').equals(Sku.create('ABC-1'))).toBe(true);
    });

    it('is false for a different value', () => {
      expect(Sku.create('abc-1').equals(Sku.create('abc-2'))).toBe(false);
    });

    it('is false for values that are not skus', () => {
      const sku = Sku.create('abc-1');

      expect(sku.equals('ABC-1')).toBe(false);
      expect(sku.equals(null)).toBe(false);
      expect(sku.equals({ value: 'ABC-1' })).toBe(false);
    });
  });
});
