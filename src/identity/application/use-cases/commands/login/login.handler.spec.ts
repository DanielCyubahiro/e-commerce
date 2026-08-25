import { catchRejection } from '@test/support/catch-error';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { Password, PasswordHash, SecretToken } from '@/identity/domain';
import { EmailNotVerifiedException } from '../../../exceptions/email-not-verified.exception';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { LoginCommand } from './login.command';
import { LoginHandler } from './login.handler';

describe('LoginHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };
  const origin = { userAgent: 'Firefox/142', ipAddress: '10.0.0.1' };
  const login = (
    email = 'ada@example.com',
    password = 'correct horse battery',
  ): LoginCommand => new LoginCommand(email, password, origin);

  let credentials: InMemoryCredentialRepository;
  let sessions: InMemorySessionRepository;
  let hasher: FakePasswordHasher;
  let handler: LoginHandler;
  let storedHash: PasswordHash;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);
    credentials = new InMemoryCredentialRepository();
    sessions = new InMemorySessionRepository(lifetimes);
    sessions.seedUserRole(userId, 'seller');
    hasher = new FakePasswordHasher();
    handler = new LoginHandler(credentials, hasher, sessions);

    storedHash = await hasher.hash(Password.create('correct horse battery'));
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: storedHash.value,
      emailVerifiedAt: new Date(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts a session and returns its plaintext with the caller identity', async () => {
    const result = await handler.execute(login());

    expect(result).toEqual({
      token: expect.any(String) as unknown,
      userId,
      role: 'seller',
    });
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('stores only the digest of the token it returns', async () => {
    const result = await handler.execute(login());

    expect(sessions.rows().map((row) => row.tokenHash)).toEqual([
      SecretToken.hashOf(result.token).value,
    ]);
  });

  it('records where the session came from, stamped with the current time', async () => {
    await handler.execute(login());

    expect(sessions.rows()[0]).toMatchObject({
      userId,
      userAgent: 'Firefox/142',
      ipAddress: '10.0.0.1',
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null,
    });
  });

  it('starts a new session per login, so devices are independent', async () => {
    await handler.execute(login());
    await handler.execute(login());

    expect(new Set(sessions.rows().map((row) => row.id)).size).toBe(2);
  });

  it('returns a token the repository recognises on the next request', async () => {
    const result = await handler.execute(login());

    await expect(
      sessions.touch(SecretToken.hashOf(result.token), now),
    ).resolves.toEqual({
      userId,
      role: 'seller',
      sessionId: sessions.rows()[0]?.id,
    });
  });

  it('rejects a wrong password', async () => {
    const error = await catchRejection(
      () => handler.execute(login('ada@example.com', 'wrong')),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('answers a nonexistent address with the same code as a wrong password', async () => {
    const error = await catchRejection(
      () => handler.execute(login('nobody@example.com', 'whatever')),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('still spends a hash verification when no account matches', async () => {
    // The timing defence. Asserted by observing the work, because timing itself
    // is not something a unit test can assert reliably.
    const spy = jest.spyOn(hasher, 'verify');

    await catchRejection(
      () => handler.execute(login('nobody@example.com', 'whatever')),
      InvalidCredentialsException,
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1].value).toBe(hasher.dummyHash().value);
  });

  it('starts nothing when the password is wrong', async () => {
    await catchRejection(
      () => handler.execute(login('ada@example.com', 'wrong')),
      InvalidCredentialsException,
    );

    expect(sessions.rows()).toHaveLength(0);
  });

  it('refuses an unverified account, distinctly', async () => {
    credentials.clear();
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: storedHash.value,
      emailVerifiedAt: null,
    });

    const error = await catchRejection(
      () => handler.execute(login()),
      EmailNotVerifiedException,
    );

    expect(error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
  });

  it('reports unverified only after the password verifies', async () => {
    // Otherwise the code is an oracle: it would confirm the address exists to
    // anyone who guessed it, without knowing the password.
    credentials.clear();
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: storedHash.value,
      emailVerifiedAt: null,
    });

    const error = await catchRejection(
      () => handler.execute(login('ada@example.com', 'wrong')),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('accepts a stored password shorter than the current policy', async () => {
    // PasswordAttempt has no minimum, on purpose: a tightened policy must not
    // lock out an account whose hash predates it. Built directly in the
    // fake's own encoding, not through Password.create, which cannot produce
    // a sub-policy value by construction.
    credentials.clear();
    const legacy = PasswordHash.create('fake-hash:1:short');
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: legacy.value,
      emailVerifiedAt: new Date(),
    });

    const result = await handler.execute(login('ada@example.com', 'short'));

    expect(result.token).toEqual(expect.any(String));
  });
});
