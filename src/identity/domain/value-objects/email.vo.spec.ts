import { catchError } from '@test/support/catch-error';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';
import { Email } from './email.vo';

describe('Email', () => {
  it('trims and lowercases, so case never splits an identity', () => {
    expect(Email.create('  Bob@Example.COM ').value).toBe('bob@example.com');
  });

  it('compares by value', () => {
    expect(
      Email.create('bob@example.com').equals(Email.create('BOB@example.com')),
    ).toBe(true);
    expect(
      Email.create('bob@example.com').equals(Email.create('ann@example.com')),
    ).toBe(false);
    expect(Email.create('bob@example.com').equals('bob@example.com')).toBe(
      false,
    );
  });

  it.each([
    ['no at sign', 'bobexample.com'],
    ['two at signs', 'bob@ex@ample.com'],
    ['empty local part', '@example.com'],
    ['empty domain', 'bob@'],
    ['domain without a dot', 'bob@example'],
    ['domain starting with a dot', 'bob@.example.com'],
    ['domain ending with a dot', 'bob@example.'],
  ])('rejects %s', (_case, value) => {
    const error = catchError(() => Email.create(value), InvalidEmailException);

    expect(error).toBeInstanceOf(InvalidEmailException);
    expect(error.code).toBe('USER_EMAIL_INVALID');
  });

  it('rejects an address over 254 characters', () => {
    const error = catchError(
      () => Email.create(`${'a'.repeat(250)}@example.com`),
      InvalidEmailException,
    );

    expect(error).toBeInstanceOf(InvalidEmailException);
  });
});
