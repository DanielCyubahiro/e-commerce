import { catchError } from '@test/support/catch-error';
import { InvalidTokenPurposeException } from '../exceptions/invalid-token-purpose.exception';
import { TokenPurpose } from './token-purpose.vo';

describe('TokenPurpose', () => {
  it('accepts each member of the closed set', () => {
    expect(TokenPurpose.create('password-reset').value).toBe('password-reset');
    expect(TokenPurpose.create('email-verification').value).toBe(
      'email-verification',
    );
  });

  it('offers a named factory per member, so callers write no string literals', () => {
    expect(TokenPurpose.passwordReset().value).toBe('password-reset');
    expect(TokenPurpose.emailVerification().value).toBe('email-verification');
  });

  it('trims and lowercases', () => {
    expect(TokenPurpose.create('  Password-Reset ').value).toBe(
      'password-reset',
    );
  });

  it('rejects anything outside the set', () => {
    const error = catchError(
      () => TokenPurpose.create('login'),
      InvalidTokenPurposeException,
    );

    expect(error.code).toBe('USER_TOKEN_PURPOSE_INVALID');
  });

  it('compares by value', () => {
    expect(
      TokenPurpose.passwordReset().equals(TokenPurpose.passwordReset()),
    ).toBe(true);
    expect(
      TokenPurpose.passwordReset().equals(TokenPurpose.emailVerification()),
    ).toBe(false);
  });
});
