import type { Email, PasswordHash, UserId } from '@/identity/domain';

export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');

/**
 * Everything login needs about an account, in one lookup. A projection rather
 * than an aggregate: none of these fields carries an invariant a stored row
 * could violate, so there is nothing for a construction path to validate. See
 * ADR 0013.
 *
 * `role` is the raw stored string, following `UserReadRepository`'s reasoning:
 * nothing branches on it, it goes straight into a token claim, so parsing it
 * through `UserRole` would buy nothing.
 *
 * `emailVerifiedAt` is `null` for an unverified account; see ADR 0011.
 */
export interface AuthenticationRecord {
  userId: string;
  role: string;
  passwordHash: PasswordHash;
  emailVerifiedAt: Date | null;
}

export interface CredentialRepository {
  /**
   * Joins the user row, because `email` and `role` live there while the hash
   * lives on the credential.
   *
   * @returns null when no user holds that email. The caller must still spend a
   * verification against `PasswordHasher.dummyHash()` on that path, or the
   * response time reveals which addresses exist.
   */
  findAuthentication(email: Email): Promise<AuthenticationRecord | null>;

  /** @returns null when that user has no credential */
  findPasswordHash(userId: UserId): Promise<PasswordHash | null>;

  /**
   * Guarded on the timestamp still being null, so a replayed verification link
   * cannot move it forward.
   *
   * @returns false when the credential is missing or already verified. The two
   * are not distinguished: the caller answers the same way either way.
   */
  markEmailVerified(userId: UserId, now: Date): Promise<boolean>;

  /**
   * Writes only the hash. Never touches `email_verified_at`, so changing a
   * password does not un-verify an address.
   *
   * @returns false when that user has no credential
   */
  changePassword(userId: UserId, hash: PasswordHash): Promise<boolean>;
}
