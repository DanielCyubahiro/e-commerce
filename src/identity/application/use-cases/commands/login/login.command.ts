import type { SessionOrigin } from '../../../ports/session.repository';

/**
 * `password` is a raw string, not a `PasswordAttempt`: a command crosses from
 * presentation, which may not import a domain value object. The handler is
 * what puts it through `PasswordAttempt.create`. `origin` is what the device
 * list will show for the session this login starts.
 */
export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly origin: SessionOrigin,
  ) {}
}
