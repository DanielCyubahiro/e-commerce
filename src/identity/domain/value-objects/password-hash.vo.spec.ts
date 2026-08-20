import { catchError } from '@test/support/catch-error';
import { InvalidPasswordException } from '../exceptions/invalid-password.exception';
import { PasswordHash } from './password-hash.vo';

describe('PasswordHash', () => {
  it('accepts an opaque non-empty value', () => {
    expect(
      PasswordHash.create('$argon2id$v=19$m=19456,t=2,p=1$abc$def').value,
    ).toBe('$argon2id$v=19$m=19456,t=2,p=1$abc$def');
  });

  it('rejects an empty value', () => {
    const error = catchError(
      () => PasswordHash.create(''),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
  });

  it('rejects a value longer than the column', () => {
    const error = catchError(
      () => PasswordHash.create('a'.repeat(256)),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
  });

  it('does not check the algorithm, so the hasher stays swappable', () => {
    expect(PasswordHash.create('anything-opaque').value).toBe(
      'anything-opaque',
    );
  });

  it('compares by value', () => {
    expect(PasswordHash.create('x').equals(PasswordHash.create('x'))).toBe(
      true,
    );
    expect(PasswordHash.create('x').equals(PasswordHash.create('y'))).toBe(
      false,
    );
  });
});
