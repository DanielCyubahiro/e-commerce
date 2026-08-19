import type { User, UserId, UserProfile } from '@/identity/domain';

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
   * Replaces every *mutable* field of the user holding `id`: both names, the
   * role, and the phone. Email is not among them and cannot be changed through
   * this port, so unlike the old `replace` this can never conflict on email.
   *
   * @returns false when no user held that id
   */
  replaceProfile(id: UserId, profile: UserProfile): Promise<boolean>;
}
