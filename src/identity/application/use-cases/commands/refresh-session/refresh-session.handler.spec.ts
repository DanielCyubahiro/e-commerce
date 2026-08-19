import { catchRejection } from '@test/support/catch-error';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import {
  RefreshTokenId,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import { refreshExpiry } from '../../../token-lifetimes';
import { InvalidRefreshTokenException } from '../../../exceptions/invalid-refresh-token.exception';
import { RefreshSessionCommand } from './refresh-session.command';
import { RefreshSessionHandler } from './refresh-session.handler';

describe('RefreshSessionHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
  };

  let refreshTokens: InMemoryRefreshTokenRepository;
  let issuer: FakeAccessTokenIssuer;
  let handler: RefreshSessionHandler;

  // Stands in for LoginHandler.startSession: mints one chain directly against
  // the fake, so this suite exercises RefreshSessionHandler alone rather than
  // login's own dependencies.
  const login = async (): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> => {
    const sessionId = SessionId.create();
    const refresh = SecretToken.issue();
    await refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId,
      userId: UserId.create(userId),
      tokenHash: refresh.hash,
      expiresAt: refreshExpiry(now, lifetimes),
    });
    const access = await issuer.issue({
      userId,
      role: 'seller',
      sessionId: sessionId.value,
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.plaintext,
      sessionId: sessionId.value,
    };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    refreshTokens = new InMemoryRefreshTokenRepository();
    refreshTokens.seedUserRole(userId, 'seller');
    issuer = new FakeAccessTokenIssuer();
    handler = new RefreshSessionHandler(refreshTokens, issuer, lifetimes);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a new pair and retires the presented token', async () => {
    const { refreshToken } = await login();
    const presentedHash = SecretToken.hashOf(refreshToken).value;

    const result = await handler.execute(
      new RefreshSessionCommand(refreshToken),
    );

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).not.toBe(refreshToken);
    const presentedRow = refreshTokens
      .rows()
      .find((row) => row.tokenHash === presentedHash);
    expect(presentedRow?.usedAt).not.toBeNull();
  });

  it('keeps the session id across a rotation, so logout still works', async () => {
    const first = await login();
    const rotated = await handler.execute(
      new RefreshSessionCommand(first.refreshToken),
    );

    const before = await issuer.verify(first.accessToken);
    const after = await issuer.verify(rotated.accessToken);
    expect(after?.sessionId).toBe(before?.sessionId);
  });

  it('revokes the whole chain when a retired token is presented again', async () => {
    const first = await login();
    const second = await handler.execute(
      new RefreshSessionCommand(first.refreshToken),
    );

    const replayError = await catchRejection(
      () => handler.execute(new RefreshSessionCommand(first.refreshToken)),
      InvalidRefreshTokenException,
    );
    expect(replayError.code).toBe('AUTH_REFRESH_TOKEN_INVALID');

    // The successor dies too: that is the difference between revoking a
    // chain and revoking a token. Whoever holds either copy is locked out.
    const successorError = await catchRejection(
      () => handler.execute(new RefreshSessionCommand(second.refreshToken)),
      InvalidRefreshTokenException,
    );
    expect(successorError.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });

  it('answers a replay, an expiry, a revoked chain and an unknown token identically', async () => {
    const { refreshToken: replayed } = await login();
    await handler.execute(new RefreshSessionCommand(replayed));

    const expiredSecret = SecretToken.issue();
    await refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId: SessionId.create(),
      userId: UserId.create(userId),
      tokenHash: expiredSecret.hash,
      expiresAt: new Date(now.getTime() - 1000),
    });

    const revokedSecret = SecretToken.issue();
    const revokedSession = SessionId.create();
    await refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId: revokedSession,
      userId: UserId.create(userId),
      tokenHash: revokedSecret.hash,
      expiresAt: refreshExpiry(now, lifetimes),
    });
    await refreshTokens.revokeSession(revokedSession, now);

    // One code for all four, so a caller cannot learn that detection fired.
    const codes: string[] = [];
    for (const token of [
      replayed,
      expiredSecret.plaintext,
      revokedSecret.plaintext,
      'never-issued',
    ]) {
      const error = await catchRejection(
        () => handler.execute(new RefreshSessionCommand(token)),
        InvalidRefreshTokenException,
      );
      codes.push(error.code);
    }

    expect(new Set(codes).size).toBe(1);
    expect(codes[0]).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });

  it('does not revoke a chain that was already revoked', async () => {
    const { refreshToken, sessionId } = await login();
    await refreshTokens.revokeSession(SessionId.create(sessionId), now);

    // `revoked` is classified ahead of `replayed`, so a dead chain is not
    // re-revoked on every subsequent attempt.
    const spy = jest.spyOn(refreshTokens, 'revokeSession');

    await catchRejection(
      () => handler.execute(new RefreshSessionCommand(refreshToken)),
      InvalidRefreshTokenException,
    );

    expect(spy).not.toHaveBeenCalled();
  });
});
