import { InvalidUserRoleException } from '../exceptions/invalid-user-role.exception';

// Must stay equal to the user_role pgEnum's value list in users.schema.ts. Two
// copies, nothing enforcing agreement: a third role added here alone compiles
// and fails at insert time. The schema cannot import this list, it lives in the
// shared kernel and must not depend on a bounded context.
const ROLES = ['customer', 'seller'] as const;

export type UserRoleValue = (typeof ROLES)[number];

export class UserRole {
  private readonly _value: UserRoleValue;

  private constructor(value: UserRoleValue) {
    this._value = value;
  }

  /**
   * Trims and lowercases, so `Seller` is accepted and stored as `seller`.
   *
   * @throws InvalidUserRoleException for anything outside the closed set
   */
  static create(value: string): UserRole {
    const normalised = value.trim().toLowerCase();

    if (!UserRole.isRole(normalised)) {
      throw InvalidUserRoleException.unknown(normalised, ROLES);
    }

    return new UserRole(normalised);
  }

  private static isRole(value: string): value is UserRoleValue {
    return (ROLES as readonly string[]).includes(value);
  }

  get value(): UserRoleValue {
    return this._value;
  }

  equals(other: unknown): boolean {
    return other instanceof UserRole && this._value === other._value;
  }
}
