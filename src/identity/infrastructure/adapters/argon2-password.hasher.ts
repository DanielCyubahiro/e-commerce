import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PasswordHasher } from '@/identity/application';
import {
  type Password,
  type PasswordAttempt,
  PasswordHash,
} from '@/identity/domain';

// OWASP's floor for argon2id. memoryCost is in KiB, so 19456 is 19 MiB. The
// parameters are encoded into every hash argon2 produces, so raising them later
// does not invalidate existing hashes: old ones keep verifying at the cost they
// were made with.
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

// A hash of a value no user can submit, generated once at the parameters above
// so verifying it costs what verifying a real hash costs. Regenerate it if
// OPTIONS changes, or the timing defence it exists for stops matching.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$Un3cHN4eHhRYPx0joPmDHg$psQYb07QFvt9mPgvBUXqhBaqOZhm7E/G6EzuaPYA/10';

/**
 * The only place argon2 is named. Everything above it sees `PasswordHasher`.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: Password): Promise<PasswordHash> {
    return PasswordHash.create(await argon2.hash(password.value, OPTIONS));
  }

  /**
   * argon2 throws rather than returning false when it cannot parse the stored
   * hash, which would surface to a client as a 500 on a path whose honest
   * answer is 401. The port's contract is "false, never throws", so the parse
   * failure is caught here.
   *
   * `.value` is read before the `try`, not inside it: only `argon2.verify`
   * itself can fail on a malformed digest, and keeping the property reads
   * outside the block stops an unrelated bug (say, an undefined `hash` slipping
   * past the type system) from being misreported as "wrong password" instead
   * of surfacing as the crash it actually is.
   */
  async verify(attempt: PasswordAttempt, hash: PasswordHash): Promise<boolean> {
    const encoded = hash.value;
    const candidate = attempt.value;

    try {
      return await argon2.verify(encoded, candidate);
    } catch {
      return false;
    }
  }

  dummyHash(): PasswordHash {
    return PasswordHash.create(DUMMY_HASH);
  }
}
