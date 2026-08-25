import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { SecretToken, SessionId, UserId } from '@/identity/domain';
import { LogoutCommand } from './logout.command';
import { LogoutHandler } from './logout.handler';

describe('LogoutHandler', () => {
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let sessions: InMemorySessionRepository;
  let handler: LogoutHandler;

  const startSession = async (
    userId: UserId,
  ): Promise<{ secret: SecretToken; sessionId: SessionId }> => {
    const secret = SecretToken.issue();
    const sessionId = SessionId.create();
    await sessions.start(
      {
        id: sessionId,
        userId,
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
    handler = new LogoutHandler(sessions);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ends the caller’s session while leaving another session of the same user alone', async () => {
    const userId = UserId.create();
    sessions.seedUserRole(userId.value, 'seller');
    const caller = await startSession(userId);
    const other = await startSession(userId);

    await handler.execute(
      new LogoutCommand(userId.value, caller.sessionId.value),
    );

    await expect(sessions.touch(caller.secret.hash, now)).resolves.toBeNull();
    await expect(
      sessions.touch(other.secret.hash, now),
    ).resolves.not.toBeNull();
  });

  it('resolves on a second logout of the same session', async () => {
    const userId = UserId.create();
    sessions.seedUserRole(userId.value, 'seller');
    const caller = await startSession(userId);
    await handler.execute(
      new LogoutCommand(userId.value, caller.sessionId.value),
    );

    await expect(
      handler.execute(new LogoutCommand(userId.value, caller.sessionId.value)),
    ).resolves.toBeUndefined();
  });
});
