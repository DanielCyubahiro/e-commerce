import { catchRejection } from '@test/support/catch-error';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import {
  InvalidPasswordException,
  OneTimeTokenId,
  Password,
  PasswordAttempt,
  SecretToken,
  SessionId,
  TokenPurpose,
  UserId,
} from '@/identity/domain';
import { InvalidResetTokenException } from '../../../exceptions/invalid-reset-token.exception';
import { ResetPasswordCommand } from './reset-password.command';
import { ResetPasswordHandler } from './reset-password.handler';

describe('ResetPasswordHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let tokens: InMemoryOneTimeTokenRepository;
  let credentials: InMemoryCredentialRepository;
  let sessions: InMemorySessionRepository;
  let hasher: FakePasswordHasher;
  let handler: ResetPasswordHandler;
  let storedHash: string;

  const startSession = async (): Promise<SessionId> => {
    const sessionId = SessionId.create();
    await sessions.start(
      {
        id: sessionId,
        userId: UserId.create(userId),
        tokenHash: SecretToken.issue().hash,
        origin: { userAgent: null, ipAddress: null },
      },
      now,
    );
    return sessionId;
  };

  // Seeds an account with a known stored hash and a valid, unexpired reset
  // token, returning the plaintext secret the handler must be presented with.
  const seedAccountWithResetToken = async (): Promise<{
    secret: ReturnType<typeof SecretToken.issue>;
  }> => {
    storedHash = (await hasher.hash(Password.create('the original password')))
      .value;
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: storedHash,
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    const secret = SecretToken.issue();
    await tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.passwordReset(),
      userId: UserId.create(userId),
      tokenHash: secret.hash,
      expiresAt: new Date(now.getTime() + 60 * 60_000),
    });

    return { secret };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    tokens = new InMemoryOneTimeTokenRepository();
    credentials = new InMemoryCredentialRepository();
    sessions = new InMemorySessionRepository(lifetimes);
    sessions.seedUserRole(userId, 'seller');
    hasher = new FakePasswordHasher();
    handler = new ResetPasswordHandler(tokens, credentials, sessions, hasher);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sets the new password and consumes the token', async () => {
    const { secret } = await seedAccountWithResetToken();

    await handler.execute(
      new ResetPasswordCommand(secret.plaintext, 'a new long password'),
    );

    const stored = await credentials.findPasswordHash(UserId.create(userId));
    if (stored === null) {
      throw new Error('Expected a stored password hash after reset.');
    }
    await expect(
      hasher.verify(PasswordAttempt.create('a new long password'), stored),
    ).resolves.toBe(true);

    // The token is spent: presenting it again answers `used`, not `consumed`.
    await expect(
      tokens.consume(
        SecretToken.hashOf(secret.plaintext),
        TokenPurpose.passwordReset(),
        now,
      ),
    ).resolves.toEqual({ outcome: 'used' });
  });

  it('revokes every session, including the caller’s', async () => {
    const { secret } = await seedAccountWithResetToken();
    const callerSession = await startSession();
    const otherSession = await startSession();
    // Two distinct rows, so an assertion that both are revoked afterward
    // cannot be satisfied by a fake that only ever revoked one.
    expect(sessions.rows()).toHaveLength(2);

    // The premise of a reset is that someone else may hold a session.
    await handler.execute(
      new ResetPasswordCommand(secret.plaintext, 'a new long password'),
    );

    const rows = sessions.rows();
    expect(
      rows.find((row) => row.id === callerSession.value)?.revokedAt,
    ).not.toBeNull();
    expect(
      rows.find((row) => row.id === otherSession.value)?.revokedAt,
    ).not.toBeNull();
  });

  it('rejects a weak new password before the token is spent', async () => {
    const { secret } = await seedAccountWithResetToken();

    // Order matters: consuming first would burn the token on a typo and cost
    // the user another email.
    const error = await catchRejection(
      () =>
        handler.execute(new ResetPasswordCommand(secret.plaintext, 'short')),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
    await expect(
      handler.execute(
        new ResetPasswordCommand(secret.plaintext, 'a new long password'),
      ),
    ).resolves.toBeUndefined();
  });

  it('reports an expired reset link distinctly', async () => {
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    const secret = SecretToken.issue();
    await tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.passwordReset(),
      userId: UserId.create(userId),
      tokenHash: secret.hash,
      expiresAt: new Date(now.getTime() - 1000),
    });

    const error = await catchRejection(
      () =>
        handler.execute(
          new ResetPasswordCommand(secret.plaintext, 'a new long password'),
        ),
      InvalidResetTokenException,
    );

    expect(error.code).toBe('AUTH_RESET_TOKEN_EXPIRED');
  });

  it('rejects a used reset link', async () => {
    const { secret } = await seedAccountWithResetToken();
    await handler.execute(
      new ResetPasswordCommand(secret.plaintext, 'a new long password'),
    );

    const error = await catchRejection(
      () =>
        handler.execute(
          new ResetPasswordCommand(secret.plaintext, 'another long password'),
        ),
      InvalidResetTokenException,
    );

    expect(error.code).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('refuses an email-verification token presented here', async () => {
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    const secret = SecretToken.issue();
    await tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.emailVerification(),
      userId: UserId.create(userId),
      tokenHash: secret.hash,
      expiresAt: new Date(now.getTime() + 60 * 60_000),
    });

    const error = await catchRejection(
      () =>
        handler.execute(
          new ResetPasswordCommand(secret.plaintext, 'a new long password'),
        ),
      InvalidResetTokenException,
    );

    expect(error.code).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('leaves the password unchanged when the token is not valid', async () => {
    await seedAccountWithResetToken();

    await catchRejection(
      () =>
        handler.execute(
          new ResetPasswordCommand('never-issued', 'a new long password'),
        ),
      InvalidResetTokenException,
    );

    const stored = await credentials.findPasswordHash(UserId.create(userId));
    expect(stored?.value).toBe(storedHash);
  });
});
