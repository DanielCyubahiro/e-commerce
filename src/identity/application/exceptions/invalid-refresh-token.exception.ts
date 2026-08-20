import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * The single answer to a replayed, expired, revoked or unknown refresh token.
 * Deliberately the opposite of `InvalidVerificationTokenException`: a refresh
 * token is held by whoever presents it, not delivered to an inbox, so naming
 * which check fired would tell an attacker that reuse detection triggered and
 * which copy of a stolen token they hold.
 */
export class InvalidRefreshTokenException extends ApplicationException {
  readonly code = 'AUTH_REFRESH_TOKEN_INVALID';
  readonly kind: ApplicationErrorKind = 'unauthorized';

  constructor() {
    super('The refresh token is not valid. Sign in again.');
  }
}
