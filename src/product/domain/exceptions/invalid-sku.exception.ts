import {
  DomainErrorKind,
  DomainException,
} from '../../../shared/domain/base.domain-exception';

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
