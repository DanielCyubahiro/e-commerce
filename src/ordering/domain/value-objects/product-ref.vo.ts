import { UniqueId } from '@/shared/domain';

/**
 * A reference to a product that lives in another context. Not catalogue's
 * `ProductId`: ordering never imports catalogue's domain, and the reference
 * need not resolve (the product may have been deleted since).
 */
export class ProductRef extends UniqueId<'ProductRef'> {
  static create(value?: string): ProductRef {
    return new ProductRef(this.parse(value));
  }
}
