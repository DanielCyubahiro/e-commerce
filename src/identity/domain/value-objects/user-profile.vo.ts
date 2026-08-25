import {
  InvalidUserNameException,
  type NamePart,
} from '../exceptions/invalid-user-name.exception';
import { Phone } from './phone.vo';

/**
 * `phone` accepts three spellings of absence because the edge produces all
 * three: an omitted JSON key, an explicit `undefined`, and an explicit `null`.
 * The tolerance is one-directional and ends in `create`. See ADR 0011.
 */
export interface UserProfileInput {
  firstName: string;
  lastName: string;
  phone?: string | null | undefined;
}

/**
 * Everything about a user that they may change about themselves after
 * registration. Email is deliberately absent (set once, never rewritten, so
 * nobody can claim a verified status for an address nobody confirmed; ADR
 * 0014). Role is deliberately absent too: it is granted by an operator and
 * lives on `User`, so `PUT /users/:id` cannot become privilege escalation once
 * an endpoint branches on `seller`.
 *
 * Owns the name rule, so `User.create` and an update validate through one path
 * and cannot drift.
 */
export class UserProfile {
  // Minimum 1, not 2: single-character given names exist, and rejecting them
  // would be wrong rather than strict.
  private static readonly MIN_NAME_LENGTH = 1;
  // Must stay equal to users.first_name and users.last_name's varchar length.
  private static readonly MAX_NAME_LENGTH = 100;

  private constructor(
    private readonly _firstName: string,
    private readonly _lastName: string,
    private readonly _phone: Phone | null,
  ) {}

  /**
   * @throws InvalidUserNameException when either name is empty after trimming
   * or longer than 100 characters
   * @throws InvalidPhoneException for a phone that does not normalise
   */
  static create(input: UserProfileInput): UserProfile {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    UserProfile.validateName(firstName, 'first');
    UserProfile.validateName(lastName, 'last');

    // `?? null` is where the edge's three spellings of absence become one.
    const phone = input.phone ?? null;

    return new UserProfile(
      firstName,
      lastName,
      phone === null ? null : Phone.create(phone),
    );
  }

  private static validateName(name: string, part: NamePart): void {
    if (name.length < UserProfile.MIN_NAME_LENGTH) {
      throw InvalidUserNameException.empty(part);
    }
    if (name.length > UserProfile.MAX_NAME_LENGTH) {
      throw InvalidUserNameException.tooLong(part, UserProfile.MAX_NAME_LENGTH);
    }
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  /** `null`, never `undefined`, when the user has no phone. */
  get phone(): Phone | null {
    return this._phone;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof UserProfile &&
      this._firstName === other._firstName &&
      this._lastName === other._lastName &&
      (this._phone === null
        ? other._phone === null
        : (other._phone?.equals(this._phone) ?? false))
    );
  }
}
