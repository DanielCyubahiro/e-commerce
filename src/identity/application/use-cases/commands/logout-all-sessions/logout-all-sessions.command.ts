/**
 * `userId` comes from the caller's session as the guard attached it, never
 * the body.
 */
export class LogoutAllSessionsCommand {
  constructor(public readonly userId: string) {}
}
