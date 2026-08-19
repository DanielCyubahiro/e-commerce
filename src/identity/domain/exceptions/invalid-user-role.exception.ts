import { type DomainErrorKind, DomainException } from '@/shared/domain';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidUserRoleException extends DomainException {
  readonly code = 'USER_ROLE_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static unknown(
    value: string,
    allowed: readonly string[],
  ): InvalidUserRoleException {
    return new InvalidUserRoleException(
      `User role must be one of ${allowed.join(', ')}, got "${value}".`,
    );
  }
}
