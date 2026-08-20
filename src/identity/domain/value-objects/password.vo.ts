import { InvalidPasswordException } from '../exceptions/invalid-password.exception';

const REDACTED = '[REDACTED]';

// The maximum is a denial-of-service bound rather than a strength rule: argon2
// spends 19 MiB per call on attacker-supplied input, so the input has to be
// bounded. Both types share it; only Password carries the minimum.
const MAX_LENGTH = 128;

/**
 * A password being *set*, checked against the policy: 12 to 128 characters, no
 * composition rules. Never trims, because leading and trailing whitespace is
 * part of a passphrase the user chose.
 *
 * Redacts itself in `toString` and `toJSON` so a logged command cannot carry
 * it. That is defence in depth, not a guarantee: `.value` still exposes the
 * plaintext, because the hasher needs it.
 */
export class Password {
  // 12 rather than 8: length is the only property that reliably buys entropy
  // once composition rules are off the table.
  private static readonly MIN_LENGTH = 12;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * @throws InvalidPasswordException below 12 or above 128 characters
   */
  static create(raw: string): Password {
    if (raw.length < Password.MIN_LENGTH) {
      throw InvalidPasswordException.tooShort(Password.MIN_LENGTH);
    }
    if (raw.length > MAX_LENGTH) {
      throw InvalidPasswordException.tooLong(MAX_LENGTH);
    }

    return new Password(raw);
  }

  get value(): string {
    return this._value;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }
}

/**
 * A password being *presented* for verification. Bounded above but not below,
 * and this asymmetry is the point: applying the policy to an attempt would
 * refuse a user their own correct password the moment the minimum is raised,
 * because their stored hash predates the change. The hasher, not this type,
 * decides whether an attempt is right.
 */
export class PasswordAttempt {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * @throws InvalidPasswordException above 128 characters
   */
  static create(raw: string): PasswordAttempt {
    if (raw.length > MAX_LENGTH) {
      throw InvalidPasswordException.tooLong(MAX_LENGTH);
    }

    return new PasswordAttempt(raw);
  }

  get value(): string {
    return this._value;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }
}
