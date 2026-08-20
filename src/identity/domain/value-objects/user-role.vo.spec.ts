import { catchError } from '@test/support/catch-error';
import { InvalidUserRoleException } from '../exceptions/invalid-user-role.exception';
import { UserRole } from './user-role.vo';

describe('UserRole', () => {
  it.each(['customer', 'seller'])('accepts %s', (role) => {
    expect(UserRole.create(role).value).toBe(role);
  });

  it('trims and lowercases', () => {
    expect(UserRole.create('  Seller ').value).toBe('seller');
  });

  it('rejects a role outside the closed set', () => {
    const error = catchError(
      () => UserRole.create('admin'),
      InvalidUserRoleException,
    );

    expect(error).toBeInstanceOf(InvalidUserRoleException);
    expect(error.code).toBe('USER_ROLE_INVALID');
  });

  it('compares by value', () => {
    expect(UserRole.create('seller').equals(UserRole.create('SELLER'))).toBe(
      true,
    );
    expect(UserRole.create('seller').equals(UserRole.create('customer'))).toBe(
      false,
    );
    expect(UserRole.create('seller').equals('seller')).toBe(false);
  });
});
