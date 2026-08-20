import { UniqueId } from '@/shared/domain';

/**
 * Identifies one refresh token row: one link in a session's rotation chain.
 */
export class RefreshTokenId extends UniqueId<'RefreshTokenId'> {
  /**
   * `create()` with no argument mints a new UUID. `create(value)` parses and
   * validates `value` instead, inheriting the contract of `UniqueId.parse`.
   */
  static create(value?: string): RefreshTokenId {
    return new RefreshTokenId(this.parse(value));
  }
}
