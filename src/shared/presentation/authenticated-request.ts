import type { Request } from 'express';

/** Exactly the access token's claims. Nothing here is read from the database. */
export interface AuthenticatedUser {
  userId: string;
  role: string;
  sessionId: string;
}

/**
 * `user` is optional because a `@Public()` endpoint reaches its handler without
 * the guard attaching anything.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
