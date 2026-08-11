import { InvalidSkuException } from '../exceptions/invalid-sku.exception';

export class Sku {
  private static readonly SKU_REGEX = /^[A-Za-z0-9-]+$/;
  private static readonly MAX_LENGTH = 50;
  private static readonly MIN_LENGTH = 3;
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

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

  equals(other: Sku): boolean {
    return this._value === other._value;
  }
}
