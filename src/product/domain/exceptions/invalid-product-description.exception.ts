import { type DomainErrorKind, DomainException } from '@/shared/domain';

/**
 * `kind: 'invariant'` surfaces as 422 Unprocessable Entity, per
 * `STATUS_BY_KIND` in `domain-exception.filter.ts`.
 */
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
