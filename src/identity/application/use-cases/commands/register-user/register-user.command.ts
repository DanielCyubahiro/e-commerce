import type { UserInput } from '@/identity/domain';

/**
 * `password` is a raw string, not a `Password`: a command crosses from
 * presentation, which may not import a domain value object. The handler is what
 * puts it through `Password.create`.
 */
export class RegisterUserCommand {
  constructor(
    public readonly fields: UserInput,
    public readonly password: string,
  ) {}
}
