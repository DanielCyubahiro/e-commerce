import { AggregateRoot } from '@/shared/domain';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import {
  UserProfile,
  type UserProfileInput,
} from '../value-objects/user-profile.vo';

export interface UserInput extends UserProfileInput {
  email: string;
}

/**
 * A user is an identity, an email address, and a profile. `create` is the only
 * constructor, and there is no `replace`: email is immutable after
 * registration, so an update replaces a `UserProfile` and never a `User`. That
 * restores ADR 0002's original property, which ADR 0008 had narrowed, and ADR
 * 0014 records why.
 *
 * Every invariant is owned by the value object it belongs to, so nothing
 * downstream re-checks.
 */
export class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    private readonly _email: Email,
    private readonly _profile: UserProfile,
  ) {
    super(id);
  }

  /**
   * Takes one object rather than positional arguments because four of the five
   * fields are strings, so `create(firstName, lastName, email, role)` accepts
   * `email` and `role` transposed without complaint.
   */
  static create(input: UserInput): User {
    return new User(
      UserId.create(),
      Email.create(input.email),
      UserProfile.create(input),
    );
  }

  get email(): Email {
    return this._email;
  }

  /**
   * Exposed whole rather than through four forwarding getters: `user.firstName`
   * would add a hop and no meaning.
   */
  get profile(): UserProfile {
    return this._profile;
  }
}
