import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * `kind: 'not-found'` surfaces as 404. Raised for an unknown id, an already
 * revoked or expired session, and another user's session alike: the
 * repository predicate that scopes revocation to the caller is what makes
 * those indistinguishable, and this one exception keeps them so on the wire.
 */
export class SessionNotFoundException extends ApplicationException {
  readonly code = 'AUTH_SESSION_NOT_FOUND';
  readonly kind: ApplicationErrorKind = 'not-found';

  constructor(readonly sessionId: string) {
    super(`No live session found with id "${sessionId}".`);
  }
}
