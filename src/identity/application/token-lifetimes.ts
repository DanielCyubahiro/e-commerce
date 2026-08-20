export const TOKEN_LIFETIMES = Symbol('TOKEN_LIFETIMES');

/**
 * The three configured token lifetimes, in the units the environment declares
 * them in. Provided by `identity.module.ts` from `ConfigService`, so no handler
 * carries a configuration key.
 */
export interface TokenLifetimes {
  refreshTokenDays: number;
  passwordResetMinutes: number;
  emailVerificationHours: number;
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
