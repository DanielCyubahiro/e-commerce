import { type DomainErrorKind, DomainException } from '@/shared/domain';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidOrderLinesException extends DomainException {
  readonly code = 'ORDER_LINES_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static empty(): InvalidOrderLinesException {
    return new InvalidOrderLinesException('An order needs at least one line.');
  }

  static tooMany(max: number): InvalidOrderLinesException {
    return new InvalidOrderLinesException(
      `An order can carry at most ${max} lines.`,
    );
  }

  static duplicateProduct(productId: string): InvalidOrderLinesException {
    return new InvalidOrderLinesException(
      `Product ${productId} appears on more than one line; merge the quantities.`,
    );
  }

  static mixedCurrencies(
    expected: string,
    found: string,
  ): InvalidOrderLinesException {
    return new InvalidOrderLinesException(
      `Every line must be priced in one currency, found ${found} alongside ${expected}.`,
    );
  }
}
