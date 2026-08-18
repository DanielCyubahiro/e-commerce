import type { Product, ProductId } from '@/product/domain';

export const PRODUCT_WRITE_REPOSITORY = Symbol('PRODUCT_WRITE_REPOSITORY');

export interface ProductWriteRepository {
  /**
   * SKU uniqueness is enforced by the store, not by a prior lookup, so two
   * concurrent callers cannot both pass a check and then collide.
   *
   * @throws DuplicateSkuException when another product already holds this SKU
   */
  add(product: Product): Promise<void>;

  /** @returns false when no product held that id */
  delete(id: ProductId): Promise<boolean>;

  /**
   * Replaces every field of the product holding `product.id`; there is no way
   * to merge a subset. SKU uniqueness is arbitrated by the store exactly as in
   * `add`, so rewriting a product's own SKU is never a conflict.
   *
   * @returns false when no product held that id
   * @throws DuplicateSkuException when another product already holds this SKU
   */
  replace(product: Product): Promise<boolean>;
}
