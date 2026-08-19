import { type DomainErrorKind, DomainException } from '@/shared/domain';

/**
 * `kind: 'invariant'` surfaces as 422 Unprocessable Entity, per
 * `STATUS_BY_KIND` in `domain-exception.filter.ts`.
 */
export class InvalidSkuException extends DomainException {
  readonly code = 'PRODUCT_SKU_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static outOfRange(minLength: number, maxLength: number): InvalidSkuException {
    return new InvalidSkuException(
      `SKU must be between ${minLength} and ${maxLength} characters.`,
    );
  }

  static invalidCharacters(): InvalidSkuException {
    return new InvalidSkuException(
      'SKU can only contain alphanumeric characters and dashes.',
    );
  }
}
