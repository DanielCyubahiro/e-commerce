import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * 403 rather than 401: the cookie may be perfectly valid; it is the request's
 * provenance that is refused. `origin` is echoed so a frontend developer sees
 * a CORS or `WEB_BASE_URL` mistake at once. An attacker's page gains nothing
 * from it: CORS stops that page reading the response at all.
 */
export class ForbiddenOriginException extends ApplicationException {
  readonly code = 'AUTH_ORIGIN_FORBIDDEN';
  readonly kind: ApplicationErrorKind = 'forbidden';

  constructor(readonly origin: string) {
    super(`Requests from origin "${origin}" are not accepted.`);
  }
}
