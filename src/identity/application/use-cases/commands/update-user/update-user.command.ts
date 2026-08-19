import type { UserInput } from '@/identity/domain';

/** Carries `fields` as one object for the same reason `CreateUserCommand` does. */
export class UpdateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly fields: UserInput,
  ) {}
}
