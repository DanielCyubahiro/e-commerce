import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * `kind: 'conflict'` surfaces as 409 Conflict, per `STATUS_BY_KIND` in
 * `application-exception.filter.ts`. `code` is the stable
 * `PRODUCT_SKU_DUPLICATE` identifier in that response.
 */
export class DuplicateSkuException extends ApplicationException {
  readonly code = 'PRODUCT_SKU_DUPLICATE';
  readonly kind: ApplicationErrorKind = 'conflict';

  constructor(readonly sku: string) {
    super(`A product with SKU "${sku}" already exists.`);
  }
}
