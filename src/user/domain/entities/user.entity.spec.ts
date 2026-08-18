import { catchError } from '@test/support/catch-error';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';
import { InvalidUserNameException } from '../exceptions/invalid-user-name.exception';
import { UserId } from '../value-objects/user-id.vo';
import { User, type UserInput } from './user.entity';

const input = (overrides: Partial<UserInput> = {}): UserInput => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'seller',
  ...overrides,
});

describe('User', () => {
  it('trims both names and normalises every value object', () => {
    const user = User.create(
      input({ firstName: '  Ada ', email: 'ADA@Example.com', role: 'Seller' }),
    );

    expect(user.firstName).toBe('Ada');
    expect(user.lastName).toBe('Lovelace');
    expect(user.email.value).toBe('ada@example.com');
    expect(user.role.value).toBe('seller');
  });

  it('mints a new identity on create', () => {
    expect(User.create(input()).id.value).not.toBe(
      User.create(input()).id.value,
    );
  });

  it('replaces under an identity the caller already holds', () => {
    const id = UserId.create();

    const user = User.replace(id, input({ firstName: 'Grace' }));

    expect(user.id.equals(id)).toBe(true);
    expect(user.firstName).toBe('Grace');
  });

  it('validates on replace exactly as it does on create', () => {
    const error = catchError(
      () => User.replace(UserId.create(), input({ email: 'nope' })),
      InvalidEmailException,
    );

    expect(error).toBeInstanceOf(InvalidEmailException);
  });

  it.each<[string, UserInput]>([
    ['an absent key', input()],
    ['undefined', input({ phone: undefined })],
    ['null', input({ phone: null })],
  ])('collapses %s to a null phone', (_case, given) => {
    expect(User.create(given).phone).toBeNull();
  });

  it('normalises a phone that is present', () => {
    expect(User.create(input({ phone: '+32 489 12 34 56' })).phone?.value).toBe(
      '+32489123456',
    );
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
    expect(User.create(input({ firstName: 'O' })).firstName).toBe('O');
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
