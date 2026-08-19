/**
 * `userId` and `sessionId` come from the caller's access token claims, never
 * the body. `currentPassword` and `newPassword` are raw strings, not domain
 * value objects, for the same reason every command carrying a password is:
 * the handler is what puts each through `PasswordAttempt.create` and
 * `Password.create` respectively.
 */
export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {}
}
