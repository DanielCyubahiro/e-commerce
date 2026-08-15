import { InvalidSkuException } from '../exceptions/invalid-sku.exception';

export class Sku {
  private static readonly SKU_REGEX = /^[A-Za-z0-9-]+$/;
  // Must stay equal to products.sku's varchar length and to the bound asserted
  // in schema.integration-spec.ts. Three copies, nothing enforcing agreement;
  // see docs/backlog.md.
  private static readonly MAX_LENGTH = 50;
  private static readonly MIN_LENGTH = 3;
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Trims, then uppercases, so SKUs compare case-insensitively and the
   * `products_sku_unique` constraint does too. Callers may pass user input in
   * any case.
   *
   * @throws InvalidSkuException outside 3 to 50 characters, or on any character
   * that is not a letter, digit, or hyphen
   */
  static create(value: string): Sku {
    const trimmedValue = value.trim();
    if (
      trimmedValue.length < Sku.MIN_LENGTH ||
      trimmedValue.length > Sku.MAX_LENGTH
    ) {
      throw InvalidSkuException.outOfRange(Sku.MIN_LENGTH, Sku.MAX_LENGTH);
    }
    if (!Sku.SKU_REGEX.test(trimmedValue)) {
      throw InvalidSkuException.invalidCharacters();
    }
    return new Sku(trimmedValue.toUpperCase());
  }

  get value(): string {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof Sku && this._value === other._value;
  }
}
