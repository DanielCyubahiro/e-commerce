/** `userId` comes from the caller's access token claims, never the body. */
export class LogoutAllSessionsCommand {
  constructor(public readonly userId: string) {}
}
