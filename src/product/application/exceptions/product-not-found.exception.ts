import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

export class ProductNotFoundException extends ApplicationException {
  readonly code = 'PRODUCT_NOT_FOUND';
  readonly kind: ApplicationErrorKind = 'not-found';

  constructor(readonly productId: string) {
    super(`No product found with id "${productId}".`);
  }
}
