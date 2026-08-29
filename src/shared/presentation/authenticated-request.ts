import type { Request } from 'express';

/**
 * The owner of the live session the cookie named, read from the database on
 * this very request by `SessionAuthGuard`. `role` is therefore never stale,
 * unlike the claim a token would have carried.
 */
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
