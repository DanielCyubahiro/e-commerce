import { authWebSettingsFrom } from './auth-web-settings';

describe('authWebSettingsFrom', () => {
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  it('takes the origin of the frontend URL, dropping any path', () => {
    expect(
      authWebSettingsFrom('https://shop.example.com/app/', lifetimes)
        .allowedOrigin,
    ).toBe('https://shop.example.com');
  });

  it('marks the cookie Secure only for an https frontend', () => {
    // An https page cannot call an http API (mixed content), so the scheme of
    // the frontend decides Secure correctly with no variable to misconfigure.
    expect(
      authWebSettingsFrom('http://localhost:5173', lifetimes).cookie.secure,
    ).toBe(false);
    expect(
      authWebSettingsFrom('https://shop.example.com', lifetimes).cookie.secure,
    ).toBe(true);
  });

  it('names the cookie and gives it the idle TTL as Max-Age', () => {
    expect(
      authWebSettingsFrom('http://localhost:5173', lifetimes).cookie,
    ).toEqual({ name: 'session', secure: false, maxAgeSeconds: 2_592_000 });
  });
});
