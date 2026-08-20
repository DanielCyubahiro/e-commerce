import type {
  OneTimeTokenId,
  PasswordHash,
  TokenHash,
  User,
  UserId,
  UserProfile,
} from '@/identity/domain';

export const USER_WRITE_REPOSITORY = Symbol('USER_WRITE_REPOSITORY');

/**
 * The three rows a new account is made of. Bundled into one parameter because
 * they are written in one transaction: a user with no credential cannot log in,
 * and a user with no verification token cannot become able to, so neither is a
 * state worth being able to represent.
 */
export interface Registration {
  user: User;
  passwordHash: PasswordHash;
  verification: {
    id: OneTimeTokenId;
    tokenHash: TokenHash;
    expiresAt: Date;
  };
}

export interface UserWriteRepository {
  /**
   * Writes the user, its credential, and its first email-verification token in
   * one transaction, so a partial account is never persisted. Email uniqueness
   * is enforced by the store, not by a prior lookup, so two concurrent callers
   * cannot both pass a check and then collide.
   *
   * The port's name understates what this writes, which is deliberate: keeping
   * the three writes in one method is what makes them one transaction.
   *
   * @throws DuplicateEmailException when another user already holds this email
   */
  register(registration: Registration): Promise<void>;

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
