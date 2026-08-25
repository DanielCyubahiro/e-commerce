import { catchError } from '@test/support/catch-error';
import { InvalidUserNameException } from '../exceptions/invalid-user-name.exception';
import { UserProfile } from './user-profile.vo';

describe('UserProfile', () => {
  const input = {
    firstName: 'Ada',
    lastName: 'Lovelace',
  };

  it('trims both names', () => {
    const profile = UserProfile.create({
      ...input,
      firstName: '  Ada  ',
      lastName: '  Lovelace  ',
    });

    expect(profile.firstName).toBe('Ada');
    expect(profile.lastName).toBe('Lovelace');
  });

  it('accepts a single-character given name', () => {
    expect(UserProfile.create({ ...input, firstName: 'A' }).firstName).toBe(
      'A',
    );
  });

  it('rejects a name that is empty after trimming', () => {
    const error = catchError(
      () => UserProfile.create({ ...input, firstName: '   ' }),
      InvalidUserNameException,
    );

    expect(error.code).toBe('USER_NAME_INVALID');
  });

  it('rejects a name longer than the column', () => {
    const error = catchError(
      () => UserProfile.create({ ...input, lastName: 'a'.repeat(101) }),
      InvalidUserNameException,
    );

    expect(error.code).toBe('USER_NAME_INVALID');
  });

  it('collapses every spelling of an absent phone to null', () => {
    expect(UserProfile.create(input).phone).toBeNull();
    expect(UserProfile.create({ ...input, phone: null }).phone).toBeNull();
    expect(UserProfile.create({ ...input, phone: undefined }).phone).toBeNull();
  });

  it('validates a phone through Phone', () => {
    expect(
      UserProfile.create({ ...input, phone: '+32489123456' }).phone?.value,
    ).toBe('+32489123456');
  });

  it('carries no role: a profile is what a user may change about themselves', () => {
    expect('role' in UserProfile.create(input)).toBe(false);
  });

  it('compares by value, so two identical profiles are equal', () => {
    expect(UserProfile.create(input).equals(UserProfile.create(input))).toBe(
      true,
    );
    expect(
      UserProfile.create(input).equals(
        UserProfile.create({ ...input, firstName: 'Grace' }),
      ),
    ).toBe(false);
  });

  it('rejects a non-UserProfile value rather than throwing', () => {
    expect(UserProfile.create(input).equals({ firstName: 'Ada' })).toBe(false);
    expect(UserProfile.create(input).equals(undefined)).toBe(false);
  });

  it('compares every combination of an optional phone', () => {
    const noPhone = UserProfile.create(input);
    const withPhone = UserProfile.create({ ...input, phone: '+32489123456' });
    const withOtherPhone = UserProfile.create({
      ...input,
      phone: '+15551234567',
    });

    expect(noPhone.equals(UserProfile.create(input))).toBe(true);
    expect(noPhone.equals(withPhone)).toBe(false);
    expect(withPhone.equals(noPhone)).toBe(false);
    expect(
      withPhone.equals(UserProfile.create({ ...input, phone: '+32489123456' })),
    ).toBe(true);
    expect(withPhone.equals(withOtherPhone)).toBe(false);
  });
});
