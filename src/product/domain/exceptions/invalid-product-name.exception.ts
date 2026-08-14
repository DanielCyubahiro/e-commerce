import { type DomainErrorKind, DomainException } from '@/shared/domain';

export class InvalidProductNameException extends DomainException {
  readonly code = 'PRODUCT_NAME_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  constructor(readonly minLength: number) {
    super(`Product name must be at least ${minLength} characters long.`);
  }
}
