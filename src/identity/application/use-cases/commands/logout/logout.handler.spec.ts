import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import {
  RefreshTokenId,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import { LogoutCommand } from './logout.command';
import { LogoutHandler } from './logout.handler';

describe('LogoutHandler', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let handler: LogoutHandler;

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
    handler = new LogoutHandler(refreshTokens);
  });

  it('revokes the caller session while leaving another session of the same user alone', async () => {
    const userId = UserId.create();
    const callerSession = SessionId.create();
    const otherSession = SessionId.create();
    await issueChain(callerSession, userId);
    await issueChain(otherSession, userId);

    await handler.execute(new LogoutCommand(callerSession.value));

    const rows = refreshTokens.rows();
    expect(
      rows.find((row) => row.sessionId === callerSession.value)?.revokedAt,
    ).not.toBeNull();
    expect(
      rows.find((row) => row.sessionId === otherSession.value)?.revokedAt,
    ).toBeNull();
  });
});
