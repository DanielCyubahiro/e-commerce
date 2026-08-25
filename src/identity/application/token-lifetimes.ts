export const TOKEN_LIFETIMES = Symbol('TOKEN_LIFETIMES');

/**
 * Every configured lifetime, in the units the environment declares them in.
 * Provided by `identity.module.ts` from `ConfigService`, so no handler or
 * adapter carries a configuration key.
 */
export interface TokenLifetimes {
  refreshTokenDays: number;
  passwordResetMinutes: number;
  emailVerificationHours: number;
  /** A session dies when no request has touched it for this long. */
  sessionIdleDays: number;
  /** A session dies this long after login however active it is. */
  sessionAbsoluteDays: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function verificationExpiry(now: Date, l: TokenLifetimes): Date {
  return new Date(now.getTime() + l.emailVerificationHours * HOUR);
}

export function resetExpiry(now: Date, l: TokenLifetimes): Date {
  return new Date(now.getTime() + l.passwordResetMinutes * MINUTE);
}

export function refreshExpiry(now: Date, l: TokenLifetimes): Date {
  return new Date(now.getTime() + l.refreshTokenDays * DAY);
}

/**
 * Cutoffs rather than expiries, because a session stores no expiry: a row is
 * live while `last_seen_at` is after the idle cutoff and `created_at` is
 * after the absolute cutoff. Both the Drizzle adapter and the in-memory fake
 * apply these, and the shared contract is what keeps them agreeing.
 */
export function sessionIdleCutoff(now: Date, l: TokenLifetimes): Date {
  return new Date(now.getTime() - l.sessionIdleDays * DAY);
}

export function sessionAbsoluteCutoff(now: Date, l: TokenLifetimes): Date {
  return new Date(now.getTime() - l.sessionAbsoluteDays * DAY);
}
