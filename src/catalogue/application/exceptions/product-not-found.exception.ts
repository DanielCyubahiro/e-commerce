import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * `kind: 'not-found'` surfaces as 404 Not Found, per `STATUS_BY_KIND` in
 * `application-exception.filter.ts`. `code` is the stable
 * `PRODUCT_NOT_FOUND` identifier in that response.
 */
export class ProductNotFoundException extends ApplicationException {
  readonly code = 'PRODUCT_NOT_FOUND';
  readonly kind: ApplicationErrorKind = 'not-found';

  constructor(readonly productId: string) {
    super(`No product found with id "${productId}".`);
  }
}
