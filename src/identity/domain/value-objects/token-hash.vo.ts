import { InvalidTokenHashException } from '../exceptions/invalid-token-hash.exception';

/**
 * The stored form of an opaque secret. Distinct from `PasswordHash` as a type,
 * not only by name: both declare a private field, which makes them mutually
 * unassignable, so a password hash cannot be written where a token digest
 * belongs even though both are strings at runtime.
 */
export class TokenHash {
  // Must stay equal to refresh_tokens.token_hash and one_time_tokens.token_hash's
  // varchar length.
  static readonly LENGTH = 64;

  private static readonly PATTERN = /^[0-9a-f]{64}$/;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Lowercase only, so one digest has exactly one spelling and a lookup by
   * digest cannot miss on case.
   *
   * @throws InvalidTokenHashException for anything but 64 lowercase hex characters
   */
  static create(value: string): TokenHash {
    if (!TokenHash.PATTERN.test(value)) {
      throw InvalidTokenHashException.malformed(TokenHash.LENGTH);
    }

    return new TokenHash(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof TokenHash && this._value === other._value;
  }
}
