import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { SecretToken, SessionId, UserId } from '@/identity/domain';
import { ListSessionsQuery } from './list-sessions.query';
import { ListSessionsHandler } from './list-sessions.handler';

describe('ListSessionsHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const otherUserId = '9c858901-8a57-4791-81fe-4c455b099bc9';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let sessions: InMemorySessionRepository;
  let handler: ListSessionsHandler;

  const startSession = async (
    owner: string,
    userAgent: string | null,
  ): Promise<SessionId> => {
    const sessionId = SessionId.create();
    await sessions.start(
      {
        id: sessionId,
        userId: UserId.create(owner),
        tokenHash: SecretToken.issue().hash,
        origin: { userAgent, ipAddress: null },
      },
      now,
    );
    return sessionId;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    sessions = new InMemorySessionRepository(lifetimes);
    sessions.seedUserRole(userId, 'seller');
    sessions.seedUserRole(otherUserId, 'customer');
    handler = new ListSessionsHandler(sessions);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks the caller's own session as current and no other", async () => {
    const mine = await startSession(userId, 'Firefox');
    const otherDevice = await startSession(userId, 'Safari');

    const listed = await handler.execute(
      new ListSessionsQuery(userId, mine.value),
    );

    expect(listed.map((row) => [row.id, row.current])).toEqual(
      expect.arrayContaining([
        [mine.value, true],
        [otherDevice.value, false],
      ]),
    );
    expect(listed).toHaveLength(2);
  });

  it("lists only the caller's sessions", async () => {
    const mine = await startSession(userId, 'Firefox');
    await startSession(otherUserId, 'Chrome');

    const listed = await handler.execute(
      new ListSessionsQuery(userId, mine.value),
    );

    expect(listed.map((row) => row.id)).toEqual([mine.value]);
  });

  it('answers an empty list for a user with no live session', async () => {
    await expect(
      handler.execute(new ListSessionsQuery(userId, SessionId.create().value)),
    ).resolves.toEqual([]);
  });
});
