export class Sku {
  private static readonly SKU_REGEX = /^[A-Za-z0-9-]+$/;
  private static readonly MAX_LENGTH = 50;
  private static readonly MIN_LENGTH = 3;
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): Sku {
    const trimmedValue = value.trim();
    if (
      trimmedValue.length < Sku.MIN_LENGTH ||
      trimmedValue.length > Sku.MAX_LENGTH
    ) {
      throw new Error(
        `SKU must be between ${Sku.MIN_LENGTH} and ${Sku.MAX_LENGTH} characters.`,
      );
    }
    if (!Sku.SKU_REGEX.test(trimmedValue)) {
      throw new Error(
        'SKU can only contain alphanumeric characters and dashes.',
      );
    }
    return new Sku(trimmedValue.toUpperCase());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Sku): boolean {
    return this.value === other.value;
  }
}
