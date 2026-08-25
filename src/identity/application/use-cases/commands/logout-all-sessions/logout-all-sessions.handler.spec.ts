import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { SecretToken, SessionId, UserId } from '@/identity/domain';
import { LogoutAllSessionsCommand } from './logout-all-sessions.command';
import { LogoutAllSessionsHandler } from './logout-all-sessions.handler';

describe('LogoutAllSessionsHandler', () => {
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let sessions: InMemorySessionRepository;
  let handler: LogoutAllSessionsHandler;

  const startSession = async (userId: UserId): Promise<SecretToken> => {
    const secret = SecretToken.issue();
    await sessions.start(
      {
        id: SessionId.create(),
        userId,
        tokenHash: secret.hash,
        origin: { userAgent: null, ipAddress: null },
      },
      now,
    );
    return secret;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    sessions = new InMemorySessionRepository(lifetimes);
    handler = new LogoutAllSessionsHandler(sessions);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ends every session of the user, including the caller’s, and leaves another user alone', async () => {
    const userId = UserId.create();
    const otherUserId = UserId.create();
    sessions.seedUserRole(userId.value, 'seller');
    sessions.seedUserRole(otherUserId.value, 'customer');
    const caller = await startSession(userId);
    const otherDevice = await startSession(userId);
    const otherUser = await startSession(otherUserId);

    await handler.execute(new LogoutAllSessionsCommand(userId.value));

    await expect(sessions.touch(caller.hash, now)).resolves.toBeNull();
    await expect(sessions.touch(otherDevice.hash, now)).resolves.toBeNull();
    await expect(sessions.touch(otherUser.hash, now)).resolves.not.toBeNull();
  });
});
