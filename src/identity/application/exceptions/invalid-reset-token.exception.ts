import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * Two codes rather than one because this token reaches the account owner's
 * inbox: telling its holder "expired, ask for another" leaks nothing to anyone
 * who does not already have it, and collapsing the two would make a routine
 * expiry look like a broken link. The session cookie deliberately does the
 * opposite; see `UnauthenticatedException`.
 *
 * Never quotes the token in its message.
 */
export class InvalidResetTokenException extends ApplicationException {
  readonly kind: ApplicationErrorKind = 'unauthorized';

  private constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  static expired(): InvalidResetTokenException {
    return new InvalidResetTokenException(
      'AUTH_RESET_TOKEN_EXPIRED',
      'This password reset link has expired. Request a new one.',
    );
  }

  static invalid(): InvalidResetTokenException {
    return new InvalidResetTokenException(
      'AUTH_RESET_TOKEN_INVALID',
      'This password reset link is not valid.',
    );
  }
}
