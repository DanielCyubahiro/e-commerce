/**
 * `token` and `newPassword` are raw strings, not a `SecretToken` or a
 * `Password`: a command crosses from presentation, which may not import a
 * domain value object. The handler is what puts each through its own type.
 */
export class ResetPasswordCommand {
  constructor(
    public readonly token: string,
    public readonly newPassword: string,
  ) {}
}
