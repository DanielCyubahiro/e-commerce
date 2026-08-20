import { UniqueId } from '@/shared/domain';

/**
 * Identifies one login's rotation chain. Every refresh token minted from one
 * login shares it, which is what makes revoking a whole chain a single write.
 */
export class SessionId extends UniqueId<'SessionId'> {
  /**
   * `create()` with no argument mints a new UUID. `create(value)` parses and
   * validates `value` instead, inheriting the contract of `UniqueId.parse`.
   */
  static create(value?: string): SessionId {
    return new SessionId(this.parse(value));
  }
}
