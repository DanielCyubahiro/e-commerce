import { type DomainErrorKind, DomainException } from '@/shared/domain';

/**
 * `kind: 'invariant'` surfaces as 422 Unprocessable Entity, per
 * `STATUS_BY_KIND` in `domain-exception.filter.ts`.
 */
export class InvalidEmailException extends DomainException {
  readonly code = 'USER_EMAIL_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static malformed(): InvalidEmailException {
    return new InvalidEmailException(
      'Email must contain one @, a local part, and a dotted domain.',
    );
  }

  static tooLong(maxLength: number): InvalidEmailException {
    return new InvalidEmailException(
      `Email must be at most ${maxLength} characters long.`,
    );
  }
}
