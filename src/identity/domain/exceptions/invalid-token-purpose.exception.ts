import { type DomainErrorKind, DomainException } from '@/shared/domain';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidTokenPurposeException extends DomainException {
  readonly code = 'USER_TOKEN_PURPOSE_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static unknown(
    value: string,
    allowed: readonly string[],
  ): InvalidTokenPurposeException {
    return new InvalidTokenPurposeException(
      `Token purpose must be one of ${allowed.join(', ')}, got "${value}".`,
    );
  }
}
