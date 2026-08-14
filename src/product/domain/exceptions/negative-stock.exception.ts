import { type DomainErrorKind, DomainException } from '@/shared/domain';

export class NegativeStockException extends DomainException {
  readonly code = 'PRODUCT_STOCK_NEGATIVE';
  readonly kind: DomainErrorKind = 'invariant';

  constructor(readonly stock: number) {
    super(`Stock cannot be negative, received ${stock}.`);
  }
}
