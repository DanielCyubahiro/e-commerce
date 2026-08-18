import { InvalidPhoneException } from '../exceptions/invalid-phone.exception';

export class Phone {
  private static readonly MIN_DIGITS = 8;
  // Must stay equal to users.phone's varchar length minus one, the leading +.
  private static readonly MAX_DIGITS = 15;
  private static readonly SEPARATORS = /[\s().-]/g;
  private static readonly PLUS_AND_DIGITS = /^\+\d+$/;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Strips spaces, dots, hyphens, and parentheses, then requires a leading
   * `+` followed by 8 to 15 digits. This is not E.164: it does not check that
   * the country code is real or that a national trunk prefix has been
   * dropped, so `+320489123456` (Belgian trunk `0` kept) passes. The stored
   * value is that normalised form, never what the caller typed, so
   * `users.phone` holds one shape and two spellings of one number compare
   * equal.
   *
   * @throws InvalidPhoneException without a leading `+`, with a non-digit after
   * it, or outside 8 to 15 digits
   */
  static create(value: string): Phone {
    const normalised = value.trim().replace(Phone.SEPARATORS, '');

    if (!Phone.PLUS_AND_DIGITS.test(normalised)) {
      throw InvalidPhoneException.malformed();
    }

    const digits = normalised.length - 1;
    if (digits < Phone.MIN_DIGITS || digits > Phone.MAX_DIGITS) {
      throw InvalidPhoneException.outOfRange(
        Phone.MIN_DIGITS,
        Phone.MAX_DIGITS,
      );
    }

    return new Phone(normalised);
  }

  get value(): string {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof Phone && this._value === other._value;
  }
}
