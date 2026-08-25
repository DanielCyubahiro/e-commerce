import {
  refreshExpiry,
  resetExpiry,
  sessionAbsoluteCutoff,
  sessionIdleCutoff,
  verificationExpiry,
  type TokenLifetimes,
} from './token-lifetimes';

describe('token lifetimes', () => {
  const lifetimes: TokenLifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };
  const now = new Date('2026-08-19T10:00:00.000Z');

  it('adds the configured hours for an email verification token', () => {
    expect(verificationExpiry(now, lifetimes)).toEqual(
      new Date('2026-08-20T10:00:00.000Z'),
    );
  });

  it('adds the configured minutes for a password reset token', () => {
    expect(resetExpiry(now, lifetimes)).toEqual(
      new Date('2026-08-19T11:00:00.000Z'),
    );
  });

  it('adds the configured days for a refresh token', () => {
    expect(refreshExpiry(now, lifetimes)).toEqual(
      new Date('2026-09-18T10:00:00.000Z'),
    );
  });

  it('places the idle cutoff the configured days before now', () => {
    expect(sessionIdleCutoff(now, lifetimes)).toEqual(
      new Date('2026-07-20T10:00:00.000Z'),
    );
  });

  it('places the absolute cutoff the configured days before now', () => {
    expect(sessionAbsoluteCutoff(now, lifetimes)).toEqual(
      new Date('2025-08-19T10:00:00.000Z'),
    );
  });
});
