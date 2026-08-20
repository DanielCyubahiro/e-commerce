import { InvalidTokenPurposeException } from '../exceptions/invalid-token-purpose.exception';

// Must stay equal to the token_purpose pgEnum's value list in
// one-time-tokens.schema.ts. Two copies, nothing enforcing agreement: a third
// purpose added here alone compiles and fails at insert time. The schema cannot
// import this list, it lives in the shared kernel and must not depend on a
// bounded context.
const PURPOSES = ['password-reset', 'email-verification'] as const;

export type TokenPurposeValue = (typeof PURPOSES)[number];

/**
 * Which flow a one-time token belongs to. Load-bearing rather than descriptive:
 * `OneTimeTokenRepository.consume` matches on it, so a verification token
 * cannot be presented to reset a password.
 */
export class TokenPurpose {
  private readonly _value: TokenPurposeValue;

  private constructor(value: TokenPurposeValue) {
    this._value = value;
  }

  /**
   * Trims and lowercases.
   *
   * @throws InvalidTokenPurposeException for anything outside the closed set
   */
  static create(value: string): TokenPurpose {
    const normalised = value.trim().toLowerCase();

    if (!TokenPurpose.isPurpose(normalised)) {
      throw InvalidTokenPurposeException.unknown(normalised, PURPOSES);
    }

    return new TokenPurpose(normalised);
  }

  static passwordReset(): TokenPurpose {
    return new TokenPurpose('password-reset');
  }

  static emailVerification(): TokenPurpose {
    return new TokenPurpose('email-verification');
  }

  private static isPurpose(value: string): value is TokenPurposeValue {
    return (PURPOSES as readonly string[]).includes(value);
  }

  get value(): TokenPurposeValue {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof TokenPurpose && this._value === other._value;
  }
}
