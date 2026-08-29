import { SecretToken, SessionId, UserId } from '@/identity/domain';
import { SESSION_COOKIE_NAME } from '@/identity/presentation/auth-web-settings';
import type { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';

export interface SeededSession {
  /** Ready for supertest's `.set('Cookie', ...)`. */
  cookie: string;
  /** The same token bare, for a caller that builds the request itself. */
  plaintext: string;
  sessionId: string;
}

/**
 * Starts a live session directly in the fake and returns the `Cookie` header
 * a browser would send for it, for suites whose subject is not login itself.
 * Seeds the role the fake's `touch` joins for.
 */
export async function seedSessionCookie(
  sessions: InMemorySessionRepository,
  user: { userId: string; role: string },
  now: Date = new Date(),
): Promise<SeededSession> {
  sessions.seedUserRole(user.userId, user.role);
  const secret = SecretToken.issue();
  const sessionId = SessionId.create();

  await sessions.start(
    {
      id: sessionId,
      userId: UserId.create(user.userId),
      tokenHash: secret.hash,
      origin: { userAgent: null, ipAddress: null },
    },
    now,
  );

  return {
    cookie: `${SESSION_COOKIE_NAME}=${secret.plaintext}`,
    plaintext: secret.plaintext,
    sessionId: sessionId.value,
  };
}

/**
 * Ends a session `seedSessionCookie` started. Here rather than at the call
 * site because the port takes domain value objects, which a spec living in a
 * presentation layer may not import.
 */
export async function revokeSeededSession(
  sessions: InMemorySessionRepository,
  session: SeededSession,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await sessions.revoke(
    SessionId.create(session.sessionId),
    UserId.create(userId),
    now,
  );
}
