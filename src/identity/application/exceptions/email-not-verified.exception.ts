import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * 403 rather than 401: the credentials were right, and the account is still not
 * allowed to proceed. Raised only after the password verifies, so it cannot be
 * used to discover that an address exists.
 */
export class EmailNotVerifiedException extends ApplicationException {
  readonly code = 'AUTH_EMAIL_NOT_VERIFIED';
  readonly kind: ApplicationErrorKind = 'forbidden';

  constructor() {
    super('Verify your email address before signing in.');
  }
}
