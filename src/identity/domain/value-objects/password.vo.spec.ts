import { catchError } from '@test/support/catch-error';
import { InvalidPasswordException } from '../exceptions/invalid-password.exception';
import { Password, PasswordAttempt } from './password.vo';

describe('Password', () => {
  it('accepts a password at the minimum length', () => {
    expect(Password.create('a'.repeat(12)).value).toBe('a'.repeat(12));
  });

  it('accepts a password at the maximum length', () => {
    expect(Password.create('a'.repeat(128)).value).toHaveLength(128);
  });

  it('rejects a password below the minimum', () => {
    const error = catchError(
      () => Password.create('a'.repeat(11)),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
  });

  it('rejects a password above the maximum', () => {
    const error = catchError(
      () => Password.create('a'.repeat(129)),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
  });

  it('imposes no composition rule', () => {
    expect(Password.create('aaaaaaaaaaaa').value).toBe('aaaaaaaaaaaa');
  });

  it('does not trim, because whitespace is part of a passphrase', () => {
    expect(Password.create('  spaced pass  ').value).toBe('  spaced pass  ');
  });

  it('redacts itself when serialised', () => {
    const password = Password.create('a'.repeat(12));

    expect(JSON.stringify({ password })).toBe('{"password":"[REDACTED]"}');
    expect(String(password)).toBe('[REDACTED]');
  });
});

describe('PasswordAttempt', () => {
  it('accepts a password shorter than the policy minimum', () => {
    // A user whose password predates a tightened policy must still be able to
    // present it. Applying the policy here would lock them out with their own
    // correct password.
    expect(PasswordAttempt.create('short').value).toBe('short');
  });

  it('accepts an empty attempt, leaving the verdict to the hasher', () => {
    expect(PasswordAttempt.create('').value).toBe('');
  });

  it('still rejects an attempt above the maximum', () => {
    // The ceiling is a denial-of-service bound, not a strength rule: argon2
    // spends 19 MiB per call and the input is attacker-controlled.
    const error = catchError(
      () => PasswordAttempt.create('a'.repeat(129)),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
  });

  it('redacts itself when serialised', () => {
    const attempt = PasswordAttempt.create('secret');

    expect(JSON.stringify({ a: attempt })).toBe('{"a":"[REDACTED]"}');
    expect(String(attempt)).toBe('[REDACTED]');
  });
});
