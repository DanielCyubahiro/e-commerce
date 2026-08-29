import { catchError } from '@test/support/catch-error';
import { InvalidUserNameException } from '../exceptions/invalid-user-name.exception';
import { User, type UserInput } from './user.entity';

const input = (overrides: Partial<UserInput> = {}): UserInput => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  ...overrides,
});

describe('User', () => {
  it('trims both names and normalises every value object', () => {
    const user = User.create(
      input({ firstName: '  Ada ', email: 'ADA@Example.com' }),
    );

    expect(user.profile.firstName).toBe('Ada');
    expect(user.profile.lastName).toBe('Lovelace');
    expect(user.email.value).toBe('ada@example.com');
    expect(user.role.value).toBe('customer');
  });

  it('mints a new identity on create', () => {
    expect(User.create(input()).id.value).not.toBe(
      User.create(input()).id.value,
    );
  });

  it('exposes its profile rather than flattening it', () => {
    const user = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    expect(user.profile.firstName).toBe('Ada');
    expect(user.email.value).toBe('ada@example.com');
  });

  it('assigns the customer role itself; no input can choose another', () => {
    // Privilege is granted by an operator after the fact, never claimed at
    // registration. The type of `UserInput` has no `role`, so this is the
    // runtime half of the same rule.
    expect(User.create(input()).role.value).toBe('customer');
  });

  it('has exactly one construction path, so no unvalidated user exists', () => {
    // `replace` is gone: an update replaces a UserProfile, not a User, because
    // email is no longer replaceable.
    expect('replace' in User).toBe(false);
  });

  it.each<[string, UserInput]>([
    ['an absent key', input()],
    ['undefined', input({ phone: undefined })],
    ['null', input({ phone: null })],
  ])('collapses %s to a null phone', (_case, given) => {
    expect(User.create(given).profile.phone).toBeNull();
  });

  it('normalises a phone that is present', () => {
    expect(
      User.create(input({ phone: '+32 489 12 34 56' })).profile.phone?.value,
    ).toBe('+32489123456');
  });

  it.each<[string, UserInput]>([
    ['first', input({ firstName: '   ' })],
    ['last', input({ lastName: '' })],
  ])('rejects an empty %s name', (_part, given) => {
    const error = catchError(
      () => User.create(given),
      InvalidUserNameException,
    );

    expect(error).toBeInstanceOf(InvalidUserNameException);
    expect(error.code).toBe('USER_NAME_INVALID');
  });

  it('accepts a single-character name', () => {
    expect(User.create(input({ firstName: 'O' })).profile.firstName).toBe('O');
  });

  it.each<[string, UserInput]>([
    ['first', input({ firstName: 'a'.repeat(101) })],
    ['last', input({ lastName: 'a'.repeat(101) })],
  ])('rejects a %s name over 100 characters', (_part, given) => {
    expect(
      catchError(() => User.create(given), InvalidUserNameException),
    ).toBeInstanceOf(InvalidUserNameException);
  });
});
