import { InvalidEmailException } from '../exceptions/invalid-email.exception';

export class Email {
  // Must stay equal to users.email's varchar length.
  private static readonly MAX_LENGTH = 254;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Trims, then lowercases the whole address, so `Bob@example.com` and
   * `bob@example.com` are one identity and `users_email_unique` compares
   * case-insensitively. RFC 5321 makes the local part case-sensitive; no
   * provider treats it that way, and a case-sensitive constraint would admit
   * two accounts every human involved calls the same person.
   *
   * The shape check is deliberately loose. The RFC 5322 grammar admits
   * addresses no provider accepts while proving nothing about delivery, so this
   * rejects obvious garbage and stops there.
   *
   * @throws InvalidEmailException over 254 characters, without exactly one `@`,
   * with an empty local part, or with a domain whose dot is missing or sits at
   * either end
   */
  static create(value: string): Email {
    const normalised = value.trim().toLowerCase();

    if (normalised.length > Email.MAX_LENGTH) {
      throw InvalidEmailException.tooLong(Email.MAX_LENGTH);
    }

    const parts = normalised.split('@');
    const [local, domain] = parts;

    if (parts.length !== 2 || !local || !domain) {
      throw InvalidEmailException.malformed();
    }

    const dot = domain.indexOf('.');
    if (dot <= 0 || dot === domain.length - 1) {
      throw InvalidEmailException.malformed();
    }

    return new Email(normalised);
  }

  get value(): string {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof Email && this._value === other._value;
  }
}
