import { UniqueId } from '@/shared/domain';

export class ProductId extends UniqueId<'ProductId'> {
  /**
   * `create()` with no argument mints a new UUID. `create(value)` parses and
   * validates `value` instead, inheriting the contract of `UniqueId.parse`.
   */
  static create(value?: string): ProductId {
    return new ProductId(this.parse(value));
  }
}
