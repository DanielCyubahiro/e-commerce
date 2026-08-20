import type { PasswordHasher } from '@/identity/application';
import {
  type Password,
  type PasswordAttempt,
  PasswordHash,
} from '@/identity/domain';

const PREFIX = 'fake-hash:';
// Deliberately does NOT carry PREFIX, so `verify` bails at the prefix check and
// returns false for every attempt, the empty string included. A dummy that
// looked like a real hash would instead have to encode a password no attempt
// equals, which is a weaker guarantee than not parsing at all.
const DUMMY = 'fake-dummy:no-attempt-matches-this';

/**
 * Stands in for argon2 everywhere except the hasher's own contract binding,
 * because argon2 at 19 MiB makes a suite of handler tests slow for no coverage.
 * Held to the same contract suite as the real adapter, so it cannot drift.
 *
 * The salt is a counter rather than randomness, which keeps the fake
 * deterministic while still satisfying the contract's "hashes differently each
 * time" requirement.
 */
export class FakePasswordHasher implements PasswordHasher {
  private salt = 0;

  hash(password: Password): Promise<PasswordHash> {
    this.salt += 1;

    return Promise.resolve(
      PasswordHash.create(`${PREFIX}${this.salt}:${password.value}`),
    );
  }

  verify(attempt: PasswordAttempt, hash: PasswordHash): Promise<boolean> {
    if (!hash.value.startsWith(PREFIX)) {
      return Promise.resolve(false);
    }

    // Everything after the second colon is the original password; a password
    // containing a colon still round-trips because only the first two are
    // treated as separators.
    const [, , ...rest] = hash.value.split(':');

    return Promise.resolve(rest.join(':') === attempt.value);
  }

  dummyHash(): PasswordHash {
    return PasswordHash.create(DUMMY);
  }
}
