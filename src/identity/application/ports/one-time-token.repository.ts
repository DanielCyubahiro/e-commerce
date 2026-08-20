import type {
  OneTimeTokenId,
  TokenHash,
  TokenPurpose,
  UserId,
} from '@/identity/domain';

export const ONE_TIME_TOKEN_REPOSITORY = Symbol('ONE_TIME_TOKEN_REPOSITORY');

export interface IssuedOneTimeToken {
  id: OneTimeTokenId;
  purpose: TokenPurpose;
  userId: UserId;
  tokenHash: TokenHash;
  expiresAt: Date;
}

/**
 * Why a consume reports what it reports, rather than just succeeding or not.
 * `expired` and `used` are told apart from `unknown` because these tokens
 * arrive in the account owner's inbox: telling the holder "this link expired,
 * request another" leaks nothing to anyone who does not already hold it, and
 * collapsing the three would make a routine expiry indistinguishable from a
 * broken link.
 *
 * A new member here is a compile error in every handler that dispatches on it,
 * because each does so through a total `Record`.
 */
export type ConsumeOutcome =
  | { outcome: 'consumed'; userId: string }
  | { outcome: 'expired' }
  | { outcome: 'used' }
  | { outcome: 'unknown' };

export interface OneTimeTokenRepository {
  /**
   * Issues a token and, in the same transaction, deletes the user's prior
   * *unused* tokens of that purpose, so the link in an older email stops
   * working. Consumed tokens are kept, because they are what lets a replay be
   * reported as `used` rather than `unknown`.
   */
  issue(token: IssuedOneTimeToken): Promise<void>;

  /**
   * One guarded statement, so two concurrent presentations of the same token
   * cannot both succeed. `purpose` is part of the match, so a verification
   * token presented to reset a password answers `unknown` and stays usable for
   * its own flow.
   */
  consume(
    tokenHash: TokenHash,
    purpose: TokenPurpose,
    now: Date,
  ): Promise<ConsumeOutcome>;
}
