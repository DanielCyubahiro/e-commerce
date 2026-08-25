import { type DomainErrorKind, DomainException } from '@/shared/domain';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidQuantityException extends DomainException {
  readonly code = 'ORDER_QUANTITY_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static notAnInteger(value: number): InvalidQuantityException {
    return new InvalidQuantityException(
      `Quantity must be a whole number of units, received ${value}.`,
    );
  }

  static belowMinimum(value: number, min: number): InvalidQuantityException {
    return new InvalidQuantityException(
      `Quantity must be at least ${min}, received ${value}.`,
    );
  }

  static aboveMaximum(value: number, max: number): InvalidQuantityException {
    return new InvalidQuantityException(
      `Quantity must be at most ${max}, received ${value}.`,
    );
  }
}
