import { catchRejection } from '@test/support/catch-error';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import {
  InvalidPasswordException,
  Password,
  PasswordAttempt,
  RefreshTokenId,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

describe('ChangePasswordHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');

  let credentials: InMemoryCredentialRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let hasher: FakePasswordHasher;
  let handler: ChangePasswordHandler;
  let storedHash: string;
  let mySession: ReturnType<typeof SessionId.create>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);
    credentials = new InMemoryCredentialRepository();
    refreshTokens = new InMemoryRefreshTokenRepository();
    hasher = new FakePasswordHasher();
    handler = new ChangePasswordHandler(credentials, hasher, refreshTokens);

    storedHash = (await hasher.hash(Password.create('correct horse battery')))
      .value;
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: storedHash,
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    mySession = SessionId.create();
    await refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId: mySession,
      userId: UserId.create(userId),
      tokenHash: SecretToken.issue().hash,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('changes the password when the current one is right', async () => {
    await handler.execute(
      new ChangePasswordCommand(
        userId,
        mySession.value,
        'correct horse battery',
        'a new long password',
      ),
    );

    const stored = await credentials.findPasswordHash(UserId.create(userId));
    if (stored === null) {
      throw new Error('Expected a stored password hash after the change.');
    }
    await expect(
      hasher.verify(PasswordAttempt.create('a new long password'), stored),
    ).resolves.toBe(true);
  });

  it('refuses a wrong current password', async () => {
    // A bearer token proves someone holds the token, not that they are the
    // account owner. Without this check a stolen access token becomes
    // permanent account takeover inside its 15 minutes.
    const error = await catchRejection(
      () =>
        handler.execute(
          new ChangePasswordCommand(
            userId,
            mySession.value,
            'wrong',
            'a new long password',
          ),
        ),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('leaves the stored hash alone when the current password is wrong', async () => {
    await catchRejection(
      () =>
        handler.execute(
          new ChangePasswordCommand(
            userId,
            mySession.value,
            'wrong',
            'a new long password',
          ),
        ),
      InvalidCredentialsException,
    );

    const stored = await credentials.findPasswordHash(UserId.create(userId));
    expect(stored?.value).toBe(storedHash);
  });

  it('revokes other sessions but keeps the caller’s', async () => {
    const otherSession = SessionId.create();
    await refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId: otherSession,
      userId: UserId.create(userId),
      tokenHash: SecretToken.issue().hash,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
    });

    await handler.execute(
      new ChangePasswordCommand(
        userId,
        mySession.value,
        'correct horse battery',
        'a new long password',
      ),
    );

    const mine = refreshTokens
      .rows()
      .find((row) => row.sessionId === mySession.value);
    const other = refreshTokens
      .rows()
      .find((row) => row.sessionId === otherSession.value);
    expect(mine?.revokedAt).toBeNull();
    expect(other?.revokedAt).not.toBeNull();
  });

  it('rejects a weak new password without touching anything', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new ChangePasswordCommand(
            userId,
            mySession.value,
            'correct horse battery',
            'short',
          ),
        ),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
    const stored = await credentials.findPasswordHash(UserId.create(userId));
    expect(stored?.value).toBe(storedHash);
    expect(
      refreshTokens.rows().find((row) => row.sessionId === mySession.value)
        ?.revokedAt,
    ).toBeNull();
  });
});
