import { DomainException } from '../../../shared/domain/base.domain-exception';

export class NegativeStockException extends DomainException {
  readonly code = 'PRODUCT_STOCK_NEGATIVE';

  constructor(readonly stock: number) {
    super(`Stock cannot be negative, received ${stock}.`);
  }
}
