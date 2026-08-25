import type { TokenLifetimes } from '@/identity/application';

export const AUTH_WEB_SETTINGS = Symbol('AUTH_WEB_SETTINGS');

export const SESSION_COOKIE_NAME = 'session';

/** Everything the guard and `SessionCookie` need to know about the browser they serve. */
export interface AuthWebSettings {
  /** The only `Origin` header value accepted, and the CORS origin. */
  allowedOrigin: string;
  cookie: {
    name: string;
    /** True when the frontend is served over https; an https page cannot call an http API anyway. */
    secure: boolean;
    /** The idle TTL: the browser forgets the cookie when the server would consider it idle-expired. */
    maxAgeSeconds: number;
  };
}

const DAY_SECONDS = 86_400;

/**
 * Derives every browser-facing setting from `WEB_BASE_URL` and the configured
 * lifetimes, so there is no `SESSION_COOKIE_SECURE` variable to misconfigure,
 * and no boolean for class-transformer's implicit conversion to turn the
 * string "false" into true.
 *
 * @throws TypeError when `webBaseUrl` is not an absolute URL; env validation
 * already guarantees it is.
 */
export function authWebSettingsFrom(
  webBaseUrl: string,
  lifetimes: TokenLifetimes,
): AuthWebSettings {
  const url = new URL(webBaseUrl);

  return {
    allowedOrigin: url.origin,
    cookie: {
      name: SESSION_COOKIE_NAME,
      secure: url.protocol === 'https:',
      maxAgeSeconds: lifetimes.sessionIdleDays * DAY_SECONDS,
    },
  };
}
