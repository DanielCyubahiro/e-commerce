import { type DomainErrorKind, DomainException } from '@/shared/domain';

/**
 * Raised only when a digest reaches `TokenHash.create` malformed, which means a
 * bug rather than bad input: every digest is produced by `SecretToken`, never
 * supplied by a client. `kind: 'invariant'` surfaces as 422.
 */
export class InvalidTokenHashException extends DomainException {
  readonly code = 'USER_TOKEN_HASH_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static malformed(length: number): InvalidTokenHashException {
    return new InvalidTokenHashException(
      `A token hash must be exactly ${length} lowercase hexadecimal characters.`,
    );
  }
}
