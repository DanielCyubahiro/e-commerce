/**
 * Both ids come from the caller's own session as the guard attached it, never
 * from the body: the endpoint takes none, and scoping the revocation to the
 * caller is what stops a session id alone from ending someone else's.
 */
export class LogoutCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
  ) {}
}
