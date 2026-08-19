import { type DomainErrorKind, DomainException } from '@/shared/domain';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidPhoneException extends DomainException {
  readonly code = 'USER_PHONE_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static malformed(): InvalidPhoneException {
    return new InvalidPhoneException(
      'Phone must be a leading + followed by digits only.',
    );
  }

  static outOfRange(
    minDigits: number,
    maxDigits: number,
  ): InvalidPhoneException {
    return new InvalidPhoneException(
      `Phone must carry between ${minDigits} and ${maxDigits} digits.`,
    );
  }
}
