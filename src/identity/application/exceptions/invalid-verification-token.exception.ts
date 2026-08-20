import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * Two codes rather than one because this token reaches the account owner's
 * inbox: telling its holder "expired, ask for another" leaks nothing to anyone
 * who does not already have it, and collapsing the two would make a routine
 * 24-hour expiry look like a broken link. Refresh tokens deliberately do the
 * opposite; see `InvalidRefreshTokenException`.
 *
 * Never quotes the token in its message.
 */
export class InvalidVerificationTokenException extends ApplicationException {
  readonly kind: ApplicationErrorKind = 'unauthorized';

  private constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  static expired(): InvalidVerificationTokenException {
    return new InvalidVerificationTokenException(
      'AUTH_VERIFICATION_TOKEN_EXPIRED',
      'This verification link has expired. Request a new one.',
    );
  }

  static invalid(): InvalidVerificationTokenException {
    return new InvalidVerificationTokenException(
      'AUTH_VERIFICATION_TOKEN_INVALID',
      'This verification link is not valid.',
    );
  }
}
