import { catchError } from '@test/support/catch-error';
import { InvalidMoneyException } from '@/shared/domain';
import { InvalidProductDescriptionException } from '../exceptions/invalid-product-description.exception';
import { InvalidProductNameException } from '../exceptions/invalid-product-name.exception';
import { InvalidSkuException } from '../exceptions/invalid-sku.exception';
import { InvalidStockException } from '../exceptions/invalid-stock.exception';
import { type CreateProductInput, Product } from './product.entity';

const input = (
  overrides: Partial<CreateProductInput> = {},
): CreateProductInput => ({
  name: 'Espresso Machine',
  description: 'A machine that makes espresso.',
  price: 249.99,
  currency: 'EUR',
  sku: 'ESP-001',
  stock: 12,
  ...overrides,
});

describe('Product.create', () => {
  it('generates an identifier', () => {
    expect(Product.create(input()).id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('gives each product a distinct identifier', () => {
    expect(Product.create(input()).id.value).not.toBe(
      Product.create(input()).id.value,
    );
  });

  it('stores the price as minor units', () => {
    expect(Product.create(input()).price.minorUnits).toBe(24999);
  });

  it('normalises the sku to uppercase', () => {
    expect(Product.create(input({ sku: 'esp-001' })).sku.value).toBe('ESP-001');
  });

  it('keeps the stock it was given', () => {
    expect(Product.create(input({ stock: 7 })).stock).toBe(7);
  });

  describe('name', () => {
    it('stores the trimmed value, not the raw one', () => {
      expect(Product.create(input({ name: '  Kettle  ' })).name).toBe('Kettle');
    });

    it('rejects fewer than 2 characters after trimming', () => {
      expect(
        catchError(
          () => Product.create(input({ name: ' a ' })),
          InvalidProductNameException,
        ).message,
      ).toMatch(/at least 2/);
    });

    it('rejects more than 255 characters', () => {
      expect(
        catchError(
          () => Product.create(input({ name: 'x'.repeat(256) })),
          InvalidProductNameException,
        ).message,
      ).toMatch(/at most 255/);
    });

    it('accepts exactly 255 characters', () => {
      expect(
        Product.create(input({ name: 'x'.repeat(255) })).name,
      ).toHaveLength(255);
    });

    it('accepts exactly 2 characters', () => {
      expect(Product.create(input({ name: 'ab' })).name).toBe('ab');
    });
  });

  describe('description', () => {
    it('stores the trimmed value', () => {
      expect(
        Product.create(input({ description: '  Nice.  ' })).description,
      ).toBe('Nice.');
    });

    it('rejects a description that is empty after trimming', () => {
      expect(
        catchError(
          () => Product.create(input({ description: '   ' })),
          InvalidProductDescriptionException,
        ).code,
      ).toBe('PRODUCT_DESCRIPTION_INVALID');
    });
  });

  describe('stock', () => {
    it('accepts zero', () => {
      expect(Product.create(input({ stock: 0 })).stock).toBe(0);
    });

    it('rejects a negative quantity', () => {
      expect(
        catchError(
          () => Product.create(input({ stock: -1 })),
          InvalidStockException,
        ).message,
      ).toMatch(/cannot be negative/);
    });

    it('rejects a fractional quantity', () => {
      expect(
        catchError(
          () => Product.create(input({ stock: 1.5 })),
          InvalidStockException,
        ).message,
      ).toMatch(/whole number/);
    });
  });

  describe('rules delegated to value objects', () => {
    it('rejects a price with more than two decimal places', () => {
      expect(
        catchError(
          () => Product.create(input({ price: 19.999 })),
          InvalidMoneyException,
        ).code,
      ).toBe('MONEY_INVALID');
    });

    it('rejects a currency that is not three letters', () => {
      expect(() => Product.create(input({ currency: 'EURO' }))).toThrow(
        InvalidMoneyException.invalidCurrency('EURO').message,
      );
    });

    it('rejects a malformed sku', () => {
      expect(
        catchError(
          () => Product.create(input({ sku: 'a b' })),
          InvalidSkuException,
        ).code,
      ).toBe('PRODUCT_SKU_INVALID');
    });
  });

  describe('identity', () => {
    it('is not equal to another product with the same attributes', () => {
      expect(Product.create(input()).equals(Product.create(input()))).toBe(
        false,
      );
    });

    it('is equal to itself', () => {
      const product = Product.create(input());

      expect(product.equals(product)).toBe(true);
    });
  });
});
