import { InvalidIdentifierException } from '../exceptions/invalid-identifier.exception';

export class UniqueId {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  protected readonly _value: string;

  protected constructor(value: string) {
    this._value = value;
  }

  static create(value?: string): UniqueId {
    return new UniqueId(this.parse(value));
  }

  protected static parse(value?: string): string {
    if (value === undefined) {
      return crypto.randomUUID();
    }

    const trimmedValue = value.trim();
    if (!UniqueId.UUID_REGEX.test(trimmedValue)) {
      throw new InvalidIdentifierException(value);
    }

    return trimmedValue.toLowerCase();
  }

  get value(): string {
    return this._value;
  }

  equals(other: UniqueId): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    if (!(other instanceof UniqueId)) {
      return false;
    }

    return this._value === other._value;
  }
}
