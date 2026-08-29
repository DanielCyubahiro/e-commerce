import { AggregateRoot } from '@/shared/domain';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import {
  UserProfile,
  type UserProfileInput,
} from '../value-objects/user-profile.vo';
import { UserRole } from '../value-objects/user-role.vo';

export interface UserInput extends UserProfileInput {
  email: string;
}

/**
 * A user is an identity, an email address, a role, and a profile. `create` is
 * the only constructor, and there is no `replace`: email and role are both
 * immutable through the API, so an update replaces a `UserProfile` and never a
 * `User`. ADR 0014 records why for email; ADR 0023 records why for role.
 *
 * Every invariant is owned by the value object it belongs to, so nothing
 * downstream re-checks.
 */
export class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    private readonly _email: Email,
    private readonly _role: UserRole,
    private readonly _profile: UserProfile,
  ) {
    super(id);
  }

  /**
   * Takes one object rather than positional arguments because three of the four
   * fields are strings, so `create(firstName, lastName, email)` accepts a
   * transposition without complaint.
   *
   * Every new user is a customer. There is deliberately no way to ask for
   * another role here.
   */
  static create(input: UserInput): User {
    return new User(
      UserId.create(),
      Email.create(input.email),
      UserRole.customer(),
      UserProfile.create(input),
    );
  }

  get email(): Email {
    return this._email;
  }

  get role(): UserRole {
    return this._role;
  }

  /**
   * Exposed whole rather than through three forwarding getters: `user.firstName`
   * would add a hop and no meaning.
   */
  get profile(): UserProfile {
    return this._profile;
  }
}
