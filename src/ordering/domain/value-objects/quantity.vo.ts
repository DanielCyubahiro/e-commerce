import { InvalidQuantityException } from '../exceptions/invalid-quantity.exception';

/**
 * Units of one product on one line. Owns the one rule that must hold before
 * stock is touched: a non-positive quantity would turn `stock - qty` into an
 * increment. Used by both `OrderLineRequest` and `OrderLine`, so the rule is
 * written once.
 */
export class Quantity {
  static readonly MIN = 1;
  // A ceiling per line, not per order. The order_lines check constraint only
  // enforces the minimum; the maximum is the domain's alone.
  static readonly MAX = 999;

  private constructor(private readonly _value: number) {}

  /** @throws InvalidQuantityException for a non-integer or a value outside 1 to 999 */
  static create(value: number): Quantity {
    if (!Number.isInteger(value)) {
      throw InvalidQuantityException.notAnInteger(value);
    }
    if (value < Quantity.MIN) {
      throw InvalidQuantityException.belowMinimum(value, Quantity.MIN);
    }
    if (value > Quantity.MAX) {
      throw InvalidQuantityException.aboveMaximum(value, Quantity.MAX);
    }

    return new Quantity(value);
  }

  get value(): number {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof Quantity && this._value === other._value;
  }
}
