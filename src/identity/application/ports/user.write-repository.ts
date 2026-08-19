import type { User, UserId } from '@/identity/domain';

export const USER_WRITE_REPOSITORY = Symbol('USER_WRITE_REPOSITORY');

export interface UserWriteRepository {
  /**
   * Email uniqueness is enforced by the store, not by a prior lookup, so two
   * concurrent callers cannot both pass a check and then collide.
   *
   * @throws DuplicateEmailException when another user already holds this email
   */
  add(user: User): Promise<void>;

  /** @returns false when no user held that id */
  delete(id: UserId): Promise<boolean>;

  /**
   * Replaces every field of the user holding `user.id`; there is no way to
   * merge a subset. Email uniqueness is arbitrated by the store exactly as in
   * `add`, so rewriting a user's own email is never a conflict.
   *
   * @returns false when no user held that id
   * @throws DuplicateEmailException when another user already holds this email
   */
  replace(user: User): Promise<boolean>;
}
