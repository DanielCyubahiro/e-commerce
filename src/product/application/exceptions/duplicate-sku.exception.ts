import {
  type ApplicationErrorKind,
  ApplicationException,
} from '../../../shared/application/base.application-exception';

export class DuplicateSkuException extends ApplicationException {
  readonly code = 'PRODUCT_SKU_DUPLICATE';
  readonly kind: ApplicationErrorKind = 'conflict';

  constructor(readonly sku: string) {
    super(`A product with SKU "${sku}" already exists.`);
  }
}
