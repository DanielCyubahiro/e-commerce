import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { SecretToken, SessionId, UserId } from '@/identity/domain';
import { AuthenticateSessionCommand } from './authenticate-session.command';
import { AuthenticateSessionHandler } from './authenticate-session.handler';

describe('AuthenticateSessionHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let sessions: InMemorySessionRepository;
  let handler: AuthenticateSessionHandler;

  const startSession = async (): Promise<{
    secret: SecretToken;
    sessionId: SessionId;
  }> => {
    const secret = SecretToken.issue();
    const sessionId = SessionId.create();
    await sessions.start(
      {
        id: sessionId,
        userId: UserId.create(userId),
        tokenHash: secret.hash,
        origin: { userAgent: null, ipAddress: null },
      },
      now,
    );
    return { secret, sessionId };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    sessions = new InMemorySessionRepository(lifetimes);
    sessions.seedUserRole(userId, 'seller');
    handler = new AuthenticateSessionHandler(sessions);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('answers the owner of a live session presented by its plaintext', async () => {
    const { secret, sessionId } = await startSession();

    await expect(
      handler.execute(new AuthenticateSessionCommand(secret.plaintext)),
    ).resolves.toEqual({ userId, role: 'seller', sessionId: sessionId.value });
  });

  it('answers null for a token nobody issued', async () => {
    await expect(
      handler.execute(new AuthenticateSessionCommand('not-a-real-token')),
    ).resolves.toBeNull();
  });

  it('answers null once the session is revoked', async () => {
    const { secret, sessionId } = await startSession();
    await sessions.revoke(sessionId, UserId.create(userId), now);

    await expect(
      handler.execute(new AuthenticateSessionCommand(secret.plaintext)),
    ).resolves.toBeNull();
  });

  it('is the touch: presenting the token moves last_seen_at', async () => {
    const { secret } = await startSession();
    const later = new Date('2026-08-20T10:00:00.000Z');
    jest.setSystemTime(later);

    await handler.execute(new AuthenticateSessionCommand(secret.plaintext));

    expect(sessions.rows()[0]?.lastSeenAt).toEqual(later);
  });
});
