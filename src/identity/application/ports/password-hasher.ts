import type {
  Password,
  PasswordAttempt,
  PasswordHash,
} from '@/identity/domain';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  /** Salts internally, so the same password hashes differently every call. */
  hash(password: Password): Promise<PasswordHash>;

  /**
   * @returns false for a wrong attempt, and also for a hash this implementation
   * cannot parse. Never throws on a malformed hash: a caller has no better
   * response than "not verified", and throwing would turn a 401 into a 500.
   */
  verify(attempt: PasswordAttempt, hash: PasswordHash): Promise<boolean>;

  /**
   * A hash no attempt will ever match, whose verification costs what a real
   * one costs. Login verifies against it when no credential holds the
   * submitted email, so a nonexistent address takes as long as a wrong
   * password. Without that, response timing tells an attacker which addresses
   * have accounts, however carefully the bodies are matched.
   */
  dummyHash(): PasswordHash;
}
