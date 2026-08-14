import { InvalidIdentifierException } from '../exceptions/invalid-identifier.exception';

/**
 * `Brand` is never read at runtime. Without it every identifier is structurally
 * a `{ value: string }`, so the compiler accepts an OrderId where a ProductId
 * belongs. Runtime `equals` compares constructors for the same reason, covering
 * values that cross a boundary untyped.
 */
export abstract class UniqueId<Brand extends string = string> {
  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  declare private readonly __brand: Brand;

  protected constructor(protected readonly _value: string) {}

  protected static parse(value?: string): string {
    if (value === undefined) {
      return crypto.randomUUID();
    }

    const trimmed = value.trim();
    if (!UniqueId.UUID_PATTERN.test(trimmed)) {
      throw new InvalidIdentifierException(value);
    }

    return trimmed.toLowerCase();
  }

  get value(): string {
    return this._value;
  }

  equals(other: unknown): boolean {
    if (!(other instanceof UniqueId)) {
      return false;
    }

    return (
      this.constructor === other.constructor && this._value === other._value
    );
  }
}
