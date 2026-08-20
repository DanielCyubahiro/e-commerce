/**
 * `email` is a raw string, not an `Email`: a command crosses from
 * presentation, which may not import a domain value object. The handler is
 * what puts it through `Email.create`.
 */
export class ResendVerificationCommand {
  constructor(public readonly email: string) {}
}
