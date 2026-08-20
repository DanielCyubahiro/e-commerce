import { catchError } from '@test/support/catch-error';
import { InvalidTokenHashException } from '../exceptions/invalid-token-hash.exception';
import { TokenHash } from './token-hash.vo';

describe('TokenHash', () => {
  const valid = 'a'.repeat(64);

  it('accepts 64 lowercase hex characters', () => {
    expect(TokenHash.create(valid).value).toBe(valid);
  });

  it('rejects a digest of the wrong length', () => {
    const error = catchError(
      () => TokenHash.create('a'.repeat(63)),
      InvalidTokenHashException,
    );

    expect(error.code).toBe('USER_TOKEN_HASH_INVALID');
  });

  it('rejects uppercase hex, so one digest has one spelling', () => {
    const error = catchError(
      () => TokenHash.create('A'.repeat(64)),
      InvalidTokenHashException,
    );

    expect(error.code).toBe('USER_TOKEN_HASH_INVALID');
  });

  it('rejects non-hex characters', () => {
    const error = catchError(
      () => TokenHash.create('g'.repeat(64)),
      InvalidTokenHashException,
    );

    expect(error.code).toBe('USER_TOKEN_HASH_INVALID');
  });

  it('compares by value', () => {
    expect(TokenHash.create(valid).equals(TokenHash.create(valid))).toBe(true);
    expect(
      TokenHash.create(valid).equals(TokenHash.create('b'.repeat(64))),
    ).toBe(false);
  });

  it('is not equal to a non-TokenHash carrying the same string', () => {
    expect(TokenHash.create(valid).equals({ value: valid })).toBe(false);
  });
});
