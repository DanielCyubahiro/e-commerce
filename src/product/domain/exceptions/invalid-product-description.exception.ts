import { type DomainErrorKind, DomainException } from '@/shared/domain';

export class InvalidProductDescriptionException extends DomainException {
  readonly code = 'PRODUCT_DESCRIPTION_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static empty(): InvalidProductDescriptionException {
    return new InvalidProductDescriptionException(
      'Product description cannot be empty.',
    );
  }
}
