import { type DomainErrorKind, DomainException } from '@/shared/domain';

export class InvalidProductNameException extends DomainException {
  readonly code = 'PRODUCT_NAME_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static tooShort(minLength: number): InvalidProductNameException {
    return new InvalidProductNameException(
      `Product name must be at least ${minLength} characters long.`,
    );
  }

  static tooLong(maxLength: number): InvalidProductNameException {
    return new InvalidProductNameException(
      `Product name must be at most ${maxLength} characters long.`,
    );
  }
}
