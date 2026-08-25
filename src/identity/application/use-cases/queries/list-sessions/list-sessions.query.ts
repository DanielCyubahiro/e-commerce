/**
 * Both ids come from the caller's own session as the guard attached it.
 * `currentSessionId` is what lets the handler mark the row the request
 * arrived on; the repository never learns which session is asking.
 */
export class ListSessionsQuery {
  constructor(
    public readonly userId: string,
    public readonly currentSessionId: string,
  ) {}
}
