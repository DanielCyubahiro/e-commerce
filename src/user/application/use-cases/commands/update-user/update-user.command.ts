import type { UserInput } from '@/user/domain';

/** Carries `fields` as one object for the same reason `CreateUserCommand` does. */
export class UpdateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly fields: UserInput,
  ) {}
}
