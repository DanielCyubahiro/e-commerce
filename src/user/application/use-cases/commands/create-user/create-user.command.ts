import type { UserInput } from '@/user/domain';

/**
 * Carries its fields as one object rather than positionally, unlike
 * `CreateProductCommand`: four of the five are strings, so
 * `new CreateUserCommand(firstName, lastName, email, role)` would accept
 * `email` and `role` transposed without complaint.
 *
 * `UserInput` is the domain's own input contract, reused so the field shape
 * exists in one place. Every member is a primitive, so no domain type crosses a
 * layer boundary and presentation constructs an object literal without
 * importing the type.
 */
export class CreateUserCommand {
  constructor(public readonly fields: UserInput) {}
}
