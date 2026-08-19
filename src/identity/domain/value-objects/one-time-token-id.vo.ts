import { UniqueId } from '@/shared/domain';

/**
 * Identifies one one-time token row: a password reset or email verification
 * secret in flight.
 */
export class OneTimeTokenId extends UniqueId<'OneTimeTokenId'> {
  /**
   * `create()` with no argument mints a new UUID. `create(value)` parses and
   * validates `value` instead, inheriting the contract of `UniqueId.parse`.
   */
  static create(value?: string): OneTimeTokenId {
    return new OneTimeTokenId(this.parse(value));
  }
}
