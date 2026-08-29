/**
 * `userId` comes from the caller's own session as the guard attached it;
 * `sessionId` is the route parameter. The repository scopes the write to
 * both, which is the whole ownership check.
 */
export class RevokeSessionCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
  ) {}
}
