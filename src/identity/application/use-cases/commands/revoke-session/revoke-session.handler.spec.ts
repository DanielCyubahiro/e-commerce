import { catchRejection } from '@test/support/catch-error';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { SecretToken, SessionId, UserId } from '@/identity/domain';
import { SessionNotFoundException } from '../../../exceptions/session-not-found.exception';
import { RevokeSessionCommand } from './revoke-session.command';
import { RevokeSessionHandler } from './revoke-session.handler';

describe('RevokeSessionHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const otherUserId = '9c858901-8a57-4791-81fe-4c455b099bc9';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let sessions: InMemorySessionRepository;
  let handler: RevokeSessionHandler;

  const startSession = async (
    owner: string,
  ): Promise<{ secret: SecretToken; sessionId: SessionId }> => {
    const secret = SecretToken.issue();
    const sessionId = SessionId.create();
    await sessions.start(
      {
        id: sessionId,
        userId: UserId.create(owner),
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
    sessions.seedUserRole(otherUserId, 'customer');
    handler = new RevokeSessionHandler(sessions);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("revokes one of the caller's sessions", async () => {
    const { secret, sessionId } = await startSession(userId);

    await handler.execute(new RevokeSessionCommand(userId, sessionId.value));

    await expect(sessions.touch(secret.hash, now)).resolves.toBeNull();
  });

  it("answers not-found for another user's session and leaves it live", async () => {
    // The first ownership rule in this API. A 404 rather than a 403, so the
    // response cannot confirm that the id belongs to anyone.
    const { secret, sessionId } = await startSession(otherUserId);

    const error = await catchRejection(
      () => handler.execute(new RevokeSessionCommand(userId, sessionId.value)),
      SessionNotFoundException,
    );

    expect(error.code).toBe('AUTH_SESSION_NOT_FOUND');
    await expect(sessions.touch(secret.hash, now)).resolves.not.toBeNull();
  });

  it('answers not-found for an id nobody holds', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new RevokeSessionCommand(userId, SessionId.create().value),
        ),
      SessionNotFoundException,
    );

    expect(error.code).toBe('AUTH_SESSION_NOT_FOUND');
  });

  it('answers not-found for a session already revoked', async () => {
    const { sessionId } = await startSession(userId);
    await handler.execute(new RevokeSessionCommand(userId, sessionId.value));

    const error = await catchRejection(
      () => handler.execute(new RevokeSessionCommand(userId, sessionId.value)),
      SessionNotFoundException,
    );

    expect(error.code).toBe('AUTH_SESSION_NOT_FOUND');
  });
});
