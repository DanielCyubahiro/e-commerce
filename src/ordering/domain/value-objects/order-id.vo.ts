import { UniqueId } from '@/shared/domain';

export class OrderId extends UniqueId<'OrderId'> {
  /**
   * `create()` with no argument mints a new UUID. `create(value)` parses and
   * validates `value` instead, inheriting the contract of `UniqueId.parse`.
   */
  static create(value?: string): OrderId {
    return new OrderId(this.parse(value));
  }
}
