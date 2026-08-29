import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * Thrown by `SessionAuthGuard`, never by a handler: no application use case
 * runs without a request having already cleared the guard. Deliberately
 * identical for a missing cookie and for one naming an unknown, revoked, or
 * expired session, since telling a forger which check failed is a gift.
 */
export class UnauthenticatedException extends ApplicationException {
  readonly code = 'AUTH_UNAUTHENTICATED';
  readonly kind: ApplicationErrorKind = 'unauthorized';

  constructor() {
    super('A live session is required.');
  }
}
