import { type DomainErrorKind, DomainException } from '@/shared/domain';

/**
 * `kind: 'invariant'` surfaces as 422. No message ever quotes the offending
 * value, unlike `InvalidUserRoleException`: the value is a password.
 */
export class InvalidPasswordException extends DomainException {
  readonly code = 'USER_PASSWORD_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static tooShort(minimum: number): InvalidPasswordException {
    return new InvalidPasswordException(
      `A password must be at least ${minimum} characters.`,
    );
  }

  static tooLong(maximum: number): InvalidPasswordException {
    return new InvalidPasswordException(
      `A password must be at most ${maximum} characters.`,
    );
  }

  static malformedHash(maximum: number): InvalidPasswordException {
    return new InvalidPasswordException(
      `A password hash must be non-empty and at most ${maximum} characters.`,
    );
  }
}
