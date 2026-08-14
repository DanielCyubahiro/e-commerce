import { InvalidSkuException } from '@/product/domain/exceptions/invalid-sku.exception';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { catchError, catchRejection } from './catch-error';

describe('catchError', () => {
  it('returns the thrown exception when the class matches', () => {
    const error = catchError(() => {
      throw InvalidSkuException.invalidCharacters();
    }, InvalidSkuException);

    expect(error.code).toBe('PRODUCT_SKU_INVALID');
  });

  it('fails when nothing is thrown', () => {
    expect(() => catchError(() => 'no throw', InvalidSkuException)).toThrow(
      /nothing was thrown/,
    );
  });

  it('fails when a different exception class is thrown', () => {
    expect(() =>
      catchError(() => {
        throw InvalidMoneyException.invalidCurrency('');
      }, InvalidSkuException),
    ).toThrow(/Expected InvalidSkuException to be thrown/);
  });
});

describe('catchRejection', () => {
  it('returns the rejection reason when the class matches', async () => {
    const error = await catchRejection(
      () => Promise.reject(InvalidSkuException.invalidCharacters()),
      InvalidSkuException,
    );

    expect(error.code).toBe('PRODUCT_SKU_INVALID');
  });

  it('fails when the promise resolves', async () => {
    await expect(
      catchRejection(() => Promise.resolve('fine'), InvalidSkuException),
    ).rejects.toThrow(/the promise resolved/);
  });

  it('fails when a different exception class is rejected', async () => {
    await expect(
      catchRejection(
        () => Promise.reject(InvalidMoneyException.invalidCurrency('')),
        InvalidSkuException,
      ),
    ).rejects.toThrow(/Expected InvalidSkuException to be rejected with/);
  });
});
