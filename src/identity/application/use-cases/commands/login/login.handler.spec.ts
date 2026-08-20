import { catchRejection } from '@test/support/catch-error';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import { Password, PasswordHash, SecretToken } from '@/identity/domain';
import { EmailNotVerifiedException } from '../../../exceptions/email-not-verified.exception';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { LoginCommand } from './login.command';
import { LoginHandler } from './login.handler';

describe('LoginHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
  };

  let credentials: InMemoryCredentialRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let hasher: FakePasswordHasher;
  let issuer: FakeAccessTokenIssuer;
  let handler: LoginHandler;
  let storedHash: PasswordHash;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T10:00:00.000Z'));
    credentials = new InMemoryCredentialRepository();
    refreshTokens = new InMemoryRefreshTokenRepository();
    hasher = new FakePasswordHasher();
    issuer = new FakeAccessTokenIssuer();
    handler = new LoginHandler(
      credentials,
      hasher,
      refreshTokens,
      issuer,
      lifetimes,
    );

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

  it('returns an access token carrying the user, role and session', async () => {
    const result = await handler.execute(
      new LoginCommand('ada@example.com', 'correct horse battery'),
    );

    const claims = await issuer.verify(result.accessToken);
    expect(claims?.userId).toBe(userId);
    expect(claims?.role).toBe('seller');
    expect(claims?.sessionId).toEqual(expect.any(String));
  });

  it('returns a refresh token that is stored only as a digest', async () => {
    const result = await handler.execute(
      new LoginCommand('ada@example.com', 'correct horse battery'),
    );

    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(refreshTokens.digests()).toEqual([
      SecretToken.hashOf(result.refreshToken).value,
    ]);
  });

  it('starts a new chain per login, so devices are independent', async () => {
    const first = await handler.execute(
      new LoginCommand('ada@example.com', 'correct horse battery'),
    );
    const second = await handler.execute(
      new LoginCommand('ada@example.com', 'correct horse battery'),
    );

    const sessions = await Promise.all(
      [first, second].map(
        async (r) => (await issuer.verify(r.accessToken))?.sessionId,
      ),
    );
    expect(sessions[0]).not.toBe(sessions[1]);
  });

  it('expires the refresh token after the configured lifetime', async () => {
    await handler.execute(
      new LoginCommand('ada@example.com', 'correct horse battery'),
    );

    expect(refreshTokens.rows()[0]?.expiresAt).toEqual(
      new Date('2026-09-18T10:00:00.000Z'),
    );
  });

  it('rejects a wrong password', async () => {
    const error = await catchRejection(
      () => handler.execute(new LoginCommand('ada@example.com', 'wrong')),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('answers a nonexistent address with the same code as a wrong password', async () => {
    const error = await catchRejection(
      () => handler.execute(new LoginCommand('nobody@example.com', 'whatever')),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('still spends a hash verification when no account matches', async () => {
    // The timing defence. Asserted by observing the work, because timing itself
    // is not something a unit test can assert reliably.
    const spy = jest.spyOn(hasher, 'verify');

    await catchRejection(
      () => handler.execute(new LoginCommand('nobody@example.com', 'whatever')),
      InvalidCredentialsException,
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1].value).toBe(hasher.dummyHash().value);
  });

  it('issues nothing when the password is wrong', async () => {
    await catchRejection(
      () => handler.execute(new LoginCommand('ada@example.com', 'wrong')),
      InvalidCredentialsException,
    );

    expect(refreshTokens.rows()).toHaveLength(0);
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
      () =>
        handler.execute(
          new LoginCommand('ada@example.com', 'correct horse battery'),
        ),
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
      () => handler.execute(new LoginCommand('ada@example.com', 'wrong')),
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

    const result = await handler.execute(
      new LoginCommand('ada@example.com', 'short'),
    );

    expect(result.accessToken).toEqual(expect.any(String));
  });
});
