import { type DomainErrorKind, DomainException } from '@/shared/domain';

export class InvalidStockException extends DomainException {
  readonly code = 'PRODUCT_STOCK_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static negative(stock: number): InvalidStockException {
    return new InvalidStockException(
      `Stock cannot be negative, received ${stock}.`,
    );
  }

  static notAnInteger(stock: number): InvalidStockException {
    return new InvalidStockException(
      `Stock must be a whole number of units, received ${stock}.`,
    );
  }
}
