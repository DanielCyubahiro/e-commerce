import { AggregateRoot } from '@/shared/domain';
import {
  InvalidUserNameException,
  type NamePart,
} from '../exceptions/invalid-user-name.exception';
import { Email } from '../value-objects/email.vo';
import { Phone } from '../value-objects/phone.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';

/**
 * `phone` accepts three spellings of absence because the edge produces all
 * three: an omitted JSON key, an explicit `undefined`, and an explicit `null`.
 * The tolerance is one-directional and ends in `build`. See ADR 0011.
 */
export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string | null | undefined;
}

interface UserState {
  id: UserId;
  firstName: string;
  lastName: string;
  email: Email;
  role: UserRole;
  phone: Phone | null;
}

/**
 * The consistency boundary for a user: the name rule is validated in `build`,
 * the one path both `create` and `replace` take, and every other field is
 * validated by the value object that owns it. Callers downstream never
 * re-check.
 */
export class User extends AggregateRoot<UserId> {
  // Minimum 1, not 2: single-character given names exist, and rejecting them
  // would be wrong rather than strict.
  private static readonly MIN_NAME_LENGTH = 1;
  // Must stay equal to users.first_name and users.last_name's varchar length.
  private static readonly MAX_NAME_LENGTH = 100;

  private _firstName: string;
  private _lastName: string;
  private _email: Email;
  private _role: UserRole;
  private _phone: Phone | null;

  private constructor(state: UserState) {
    super(state.id);
    this._firstName = state.firstName;
    this._lastName = state.lastName;
    this._email = state.email;
    this._role = state.role;
    this._phone = state.phone;
  }

  /**
   * Takes one object rather than positional arguments because four of the five
   * fields are strings, so `create(firstName, lastName, email, role)` accepts
   * `email` and `role` transposed without complaint.
   */
  static create(input: UserInput): User {
    return User.build(UserId.create(), input);
  }

  /**
   * Full replacement of a user's state under an identity the caller already
   * holds, for example one parsed from a request path. Validates exactly what
   * `create` validates, so no unvalidated `User` becomes representable.
   * Constructs a replacement; it does not persist one.
   */
  static replace(id: UserId, input: UserInput): User {
    return User.build(id, input);
  }

  private static build(id: UserId, input: UserInput): User {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    User.validateName(firstName, 'first');
    User.validateName(lastName, 'last');

    // `?? null` is where the edge's three spellings of absence become one.
    const phone = input.phone ?? null;

    return new User({
      id,
      firstName,
      lastName,
      email: Email.create(input.email),
      role: UserRole.create(input.role),
      phone: phone === null ? null : Phone.create(phone),
    });
  }

  private static validateName(name: string, part: NamePart): void {
    if (name.length < User.MIN_NAME_LENGTH) {
      throw InvalidUserNameException.empty(part);
    }
    if (name.length > User.MAX_NAME_LENGTH) {
      throw InvalidUserNameException.tooLong(part, User.MAX_NAME_LENGTH);
    }
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get email(): Email {
    return this._email;
  }

  get role(): UserRole {
    return this._role;
  }

  /** `null`, never `undefined`, when the user has no phone. */
  get phone(): Phone | null {
    return this._phone;
  }
}
