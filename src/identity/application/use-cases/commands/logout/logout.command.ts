/**
 * `sessionId` comes from the caller's access token `sid` claim
 * (`AuthenticatedUser.sessionId`), never from the request body: the endpoint
 * takes no body, so a client that has lost its refresh token can still end
 * the session.
 */
export class LogoutCommand {
  constructor(public readonly sessionId: string) {}
}
