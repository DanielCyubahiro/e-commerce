import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import {
  RefreshTokenId,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import { LogoutAllSessionsCommand } from './logout-all-sessions.command';
import { LogoutAllSessionsHandler } from './logout-all-sessions.handler';

describe('LogoutAllSessionsHandler', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let handler: LogoutAllSessionsHandler;

  const issueChain = async (
    sessionId: SessionId,
    userId: UserId,
  ): Promise<void> => {
    await refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId,
      userId,
      tokenHash: SecretToken.issue().hash,
      expiresAt: new Date('2026-09-18T10:00:00.000Z'),
    });
  };

  beforeEach(() => {
    refreshTokens = new InMemoryRefreshTokenRepository();
    handler = new LogoutAllSessionsHandler(refreshTokens);
  });

  it('revokes every chain of the user, including the one it was called from, and leaves another user alone', async () => {
    const userId = UserId.create();
    const callerSession = SessionId.create();
    const otherDeviceSession = SessionId.create();
    const otherUserId = UserId.create();
    const otherUserSession = SessionId.create();
    await issueChain(callerSession, userId);
    await issueChain(otherDeviceSession, userId);
    await issueChain(otherUserSession, otherUserId);

    await handler.execute(new LogoutAllSessionsCommand(userId.value));

    const rows = refreshTokens.rows();
    expect(
      rows.find((row) => row.sessionId === callerSession.value)?.revokedAt,
    ).not.toBeNull();
    expect(
      rows.find((row) => row.sessionId === otherDeviceSession.value)?.revokedAt,
    ).not.toBeNull();
    expect(
      rows.find((row) => row.sessionId === otherUserSession.value)?.revokedAt,
    ).toBeNull();
  });
});
