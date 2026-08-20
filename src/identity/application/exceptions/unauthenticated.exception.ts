import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * Thrown by `JwtAuthGuard`, never by a handler: no application use case runs
 * without a request having already cleared the guard. Deliberately identical
 * for a missing, malformed, expired, and forged token, since telling a forger
 * which part is wrong is a gift.
 */
export class UnauthenticatedException extends ApplicationException {
  readonly code = 'AUTH_UNAUTHENTICATED';
  readonly kind: ApplicationErrorKind = 'unauthorized';

  constructor() {
    super('A valid access token is required.');
  }
}
