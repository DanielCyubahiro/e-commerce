import { UniqueId } from '@/shared/domain';

export class UserId extends UniqueId<'UserId'> {
  /**
   * `create()` with no argument mints a new UUID. `create(value)` parses and
   * validates `value` instead, inheriting the contract of `UniqueId.parse`.
   */
  static create(value?: string): UserId {
    return new UserId(this.parse(value));
  }
}
