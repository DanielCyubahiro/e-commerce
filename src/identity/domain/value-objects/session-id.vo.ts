import { UniqueId } from '@/shared/domain';

/**
 * Identifies one login. The session row carries it, so revoking that login is
 * a single write.
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
