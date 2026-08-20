import { createHash, randomBytes } from 'node:crypto';
import { TokenHash } from './token-hash.vo';

/**
 * An opaque bearer secret together with its digest. `plaintext` is the only
 * copy that leaves the process, in a response body or an email; `hash` is the
 * only copy that is ever stored. Holding both behind one type is what makes
 * "stored the secret instead of its digest" impossible to write by accident.
 */
export class SecretToken {
  // 256 bits. High enough entropy that a fast digest at rest is sufficient.
  private static readonly BYTES = 32;

  private constructor(
    private readonly _plaintext: string,
    private readonly _hash: TokenHash,
  ) {}

  /** Mints a fresh secret. */
  static issue(): SecretToken {
    const plaintext = randomBytes(SecretToken.BYTES).toString('base64url');

    return new SecretToken(plaintext, SecretToken.hashOf(plaintext));
  }

  /**
   * Recomputes the digest of a secret a caller presented, for lookup by digest.
   *
   * SHA-256 rather than argon2 deliberately: the input is 256 bits of
   * randomness, not a guessable human choice, so there is nothing for a slow
   * hash to defend, and issuer and verifier must compute the same digest for a
   * lookup to work at all.
   */
  static hashOf(plaintext: string): TokenHash {
    return TokenHash.create(
      createHash('sha256').update(plaintext, 'utf8').digest('hex'),
    );
  }

  get plaintext(): string {
    return this._plaintext;
  }

  get hash(): TokenHash {
    return this._hash;
  }

  /** Redacted so a logged command or a serialised error cannot carry the secret. */
  toJSON(): string {
    return '[REDACTED]';
  }

  toString(): string {
    return '[REDACTED]';
  }
}
