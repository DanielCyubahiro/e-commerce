import { InvalidPasswordException } from '../exceptions/invalid-password.exception';

/**
 * The stored form of a password. Deliberately opaque: it checks presence and
 * the column ceiling and nothing about the algorithm, so raising the argon2
 * cost or replacing argon2 entirely needs no change here.
 *
 * Its value as a type is that it is the only thing the write ports accept and
 * the hasher is the only thing that produces one, which turns "stored the
 * plaintext password" into a compile error rather than something review has to
 * catch.
 */
export class PasswordHash {
  // Must stay equal to credentials.password_hash's varchar length.
  private static readonly MAX_LENGTH = 255;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * @throws InvalidPasswordException when empty or over 255 characters
   */
  static create(value: string): PasswordHash {
    if (value.length === 0 || value.length > PasswordHash.MAX_LENGTH) {
      throw InvalidPasswordException.malformedHash(PasswordHash.MAX_LENGTH);
    }

    return new PasswordHash(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof PasswordHash && this._value === other._value;
  }
}
