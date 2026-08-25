import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  CREDENTIAL_REPOSITORY,
  EMAIL_SENDER,
  ONE_TIME_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  SESSION_REPOSITORY,
  TOKEN_LIFETIMES,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from '@/identity/application';
import { IdentityModule } from '@/identity/identity.module';
import {
  AUTH_WEB_SETTINGS,
  authWebSettingsFrom,
} from '@/identity/presentation/auth-web-settings';
import {
  OneTimeTokenId,
  Password,
  SecretToken,
  TokenPurpose,
  UserId,
} from '@/identity/domain';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { RecordingEmailSender } from '@test/fakes/recording-email.sender';
import { seedSessionCookie } from '@test/support/session-cookie';

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ALLOWED_ORIGIN = 'http://localhost:5173';

const lifetimes = {
  refreshTokenDays: 30,
  passwordResetMinutes: 60,
  emailVerificationHours: 24,
  sessionIdleDays: 30,
  sessionAbsoluteDays: 365,
};

interface ResponseBody {
  code?: string;
  userId?: string;
  role?: string;
  id?: string;
  userAgent?: string | null;
  current?: boolean;
}

const bodyOf = (response: request.Response): ResponseBody =>
  response.body as ResponseBody;

const listOf = (response: request.Response): ResponseBody[] =>
  response.body as ResponseBody[];

/** The `session=...` pair from Set-Cookie, ready for `.set('Cookie', ...)`. */
const sessionCookieOf = (response: request.Response): string => {
  const pair = (response.get('Set-Cookie') ?? [])
    .find((header) => header.startsWith('session='))
    ?.split(';')[0];

  if (!pair) {
    throw new Error('Expected a session cookie on the response.');
  }

  return pair;
};

const setCookiesOf = (response: request.Response): string[] =>
  response.get('Set-Cookie') ?? [];

// No cookie on the login, verify-email, and verify-email/resend cases below:
// all three are marked @Public() (auth.controller.ts), since a client cannot
// hold a session before any of them succeeds.
describe('auth HTTP contract', () => {
  let app: INestApplication<App>;
  let tokens: InMemoryOneTimeTokenRepository;
  let credentials: InMemoryCredentialRepository;
  let sessions: InMemorySessionRepository;
  let hasher: FakePasswordHasher;

  beforeEach(async () => {
    const writes = new InMemoryUserWriteRepository();
    tokens = new InMemoryOneTimeTokenRepository();
    credentials = new InMemoryCredentialRepository();
    sessions = new InMemorySessionRepository(lifetimes);
    hasher = new FakePasswordHasher();

    // Same rationale as user.http-spec.ts: this suite imports only
    // IdentityModule, so every provider identity.module.ts otherwise builds
    // from ConfigService or a real Postgres/SMTP connection is overridden
    // with a fake.
    const moduleRef = await Test.createTestingModule({
      imports: [IdentityModule],
    })
      .overrideProvider(USER_WRITE_REPOSITORY)
      .useValue(writes)
      .overrideProvider(USER_READ_REPOSITORY)
      .useValue(new InMemoryUserReadRepository(writes))
      .overrideProvider(PASSWORD_HASHER)
      .useValue(hasher)
      .overrideProvider(EMAIL_SENDER)
      .useValue(new RecordingEmailSender())
      .overrideProvider(CREDENTIAL_REPOSITORY)
      .useValue(credentials)
      .overrideProvider(ONE_TIME_TOKEN_REPOSITORY)
      .useValue(tokens)
      .overrideProvider(TOKEN_LIFETIMES)
      .useValue(lifetimes)
      .overrideProvider(SESSION_REPOSITORY)
      .useValue(sessions)
      .overrideProvider(AUTH_WEB_SETTINGS)
      .useValue(authWebSettingsFrom(ALLOWED_ORIGIN, lifetimes))
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
      { allowedOrigin: ALLOWED_ORIGIN },
    );
    // Listening on an OS-assigned port, rather than app.init(), stops
    // supertest from opening and closing an ephemeral listener on every
    // request across this suite's many cases.
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  // Shared by the me, logout, logout-all and change-password suites below:
  // each needs a real session minted through the actual login endpoint, not
  // seeded directly, since what is under test is how the session responds to
  // being presented back to the API.
  const loginViaHttp = async (
    userAgent = 'Firefox/142',
  ): Promise<{ cookie: string }> => {
    const hash = await hasher.hash(Password.create('correct horse battery'));
    credentials.seed({
      userId: USER_ID,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: hash.value,
      emailVerifiedAt: new Date(),
    });
    // The fake models no `users` table, so `touch` cannot join for a role;
    // this seam stands in for that join.
    sessions.seedUserRole(USER_ID, 'seller');

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', userAgent)
      .send({ email: 'ada@example.com', password: 'correct horse battery' })
      .expect(200);

    return { cookie: sessionCookieOf(response) };
  };

  describe('POST /auth/verify-email', () => {
    it('returns 204 for a valid, unexpired token', async () => {
      credentials.seed({
        userId: USER_ID,
        email: 'ada@example.com',
        role: 'seller',
        passwordHash: 'hash-1',
        emailVerifiedAt: null,
      });
      const secret = SecretToken.issue();
      await tokens.issue({
        id: OneTimeTokenId.create(),
        purpose: TokenPurpose.emailVerification(),
        userId: UserId.create(USER_ID),
        tokenHash: secret.hash,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: secret.plaintext })
        .expect(204);
    });

    it('returns 401 with a typed code for a token nobody issued', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: 'not-a-real-token' })
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_VERIFICATION_TOKEN_INVALID');
    });

    it('returns 400 when the body carries no token', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/verify-email/resend', () => {
    it('returns 202 for a known address', async () => {
      credentials.seed({
        userId: USER_ID,
        email: 'ada@example.com',
        role: 'seller',
        passwordHash: 'hash-1',
        emailVerifiedAt: null,
      });

      await request(app.getHttpServer())
        .post('/auth/verify-email/resend')
        .send({ email: 'ada@example.com' })
        .expect(202);
    });

    it('returns 202 for an address nobody holds, since the endpoint answers the same either way', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email/resend')
        .send({ email: 'nobody@example.com' })
        .expect(202);
    });

    it('returns 422 with a typed code for a malformed address', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-email/resend')
        .send({ email: 'nope' })
        .expect(422);

      expect(bodyOf(response).code).toBe('USER_EMAIL_INVALID');
    });
  });

  describe('POST /auth/login', () => {
    const seedAccount = async (
      overrides: { emailVerifiedAt?: Date | null } = {},
    ) => {
      const hash = await hasher.hash(Password.create('correct horse battery'));
      credentials.seed({
        userId: USER_ID,
        email: 'ada@example.com',
        role: 'seller',
        passwordHash: hash.value,
        emailVerifiedAt:
          overrides.emailVerifiedAt === undefined
            ? new Date()
            : overrides.emailVerifiedAt,
      });
    };

    it('returns 200 with the caller identity and sets the session cookie', async () => {
      await seedAccount();
      sessions.seedUserRole(USER_ID, 'seller');

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'correct horse battery' })
        .expect(200);

      expect(response.body).toEqual({ userId: USER_ID, role: 'seller' });
      const [cookie, ...rest] = setCookiesOf(response);
      expect(rest).toEqual([]);
      expect(cookie).toMatch(/^session=[A-Za-z0-9_-]+;/);
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Secure');
    });

    it('refuses a cross-site Origin with 403 before touching credentials', async () => {
      // Login CSRF: without this, a form on another site could sign the
      // victim's browser into the attacker's account.
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: 'ada@example.com', password: 'correct horse battery' })
        .expect(403);

      expect(bodyOf(response).code).toBe('AUTH_ORIGIN_FORBIDDEN');
    });

    it('accepts the frontend Origin', async () => {
      await seedAccount();
      sessions.seedUserRole(USER_ID, 'seller');

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .send({ email: 'ada@example.com', password: 'correct horse battery' })
        .expect(200);
    });

    it('returns 401 with a typed code for a wrong password', async () => {
      await seedAccount();

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'wrong password' })
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('answers an unknown address with the same status and code as a wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever password' })
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 403 with a typed code for an unverified account', async () => {
      await seedAccount({ emailVerifiedAt: null });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'correct horse battery' })
        .expect(403);

      expect(bodyOf(response).code).toBe('AUTH_EMAIL_NOT_VERIFIED');
    });

    it('returns 400 when the password is missing', async () => {
      await seedAccount();

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com' })
        .expect(400);
    });

    it('returns 422 with a typed code for a malformed email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'whatever password' })
        .expect(422);

      expect(bodyOf(response).code).toBe('USER_EMAIL_INVALID');
    });

    it('returns 400 for a password over the DTO ceiling, before the domain is ever asked', async () => {
      // LoginDto's password field is bounded at 128 to match PasswordAttempt's
      // own ceiling, the same argon2 cost defence RegisterUserDto documents.
      // The two ceilings coinciding means the DTO is always what catches an
      // over-length attempt: ValidationPipe answers before the command bus
      // ever dispatches, so this is 400 from the pipe, not 422 from the domain.
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'a'.repeat(129) })
        .expect(400);

      expect(bodyOf(response).code).toBeUndefined();
    });

    it('throttles repeated login attempts', async () => {
      // Not only about guessing: every attempt costs the server 19 MiB in
      // argon2, so an unthrottled login endpoint is a memory amplification
      // vector that needs no correct password to exploit. `beforeEach`
      // rebuilds the whole testing module per test, which is also what gives
      // this test its own throttler counter rather than one shared with its
      // neighbours.
      const attempt = () =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'ada@example.com', password: 'wrong password here' });

      for (let i = 0; i < 10; i += 1) {
        await attempt();
      }

      const response = await attempt().expect(429);
      expect(bodyOf(response).code).toBeUndefined();
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 with no cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_UNAUTHENTICATED');
    });

    it('returns 200 with the caller identity for a live session', async () => {
      const { cookie } = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body).toEqual({ userId: USER_ID, role: 'seller' });
    });

    it('re-sends the cookie on every authenticated response, so the browser slides with the row', async () => {
      const { cookie } = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      const [reissued, ...rest] = setCookiesOf(response);
      expect(rest).toEqual([]);
      expect(reissued?.split(';')[0]).toBe(cookie);
      expect(reissued).toContain('Max-Age=2592000');
    });

    it('refuses a cross-site Origin on a protected route', async () => {
      const { cookie } = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .set('Origin', 'https://evil.example')
        .expect(403);

      expect(bodyOf(response).code).toBe('AUTH_ORIGIN_FORBIDDEN');
    });

    it('answers 404 for the refresh endpoint that no longer exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'anything' })
        .expect(404);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 401 with no cookie, since the endpoint is protected', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('returns 204, clears the cookie, and the same cookie answers 401 afterwards', async () => {
      // The headline of this feature: revocation reaches the very next
      // request, with no token lifetime to wait out.
      const { cookie } = await loginViaHttp();

      const logout = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      const [cleared, ...rest] = setCookiesOf(logout);
      expect(rest).toEqual([]);
      expect(cleared).toContain('session=;');
      expect(cleared).toContain('Max-Age=0');

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      expect(bodyOf(response).code).toBe('AUTH_UNAUTHENTICATED');
    });

    it('leaves the user’s other devices signed in', async () => {
      const first = await loginViaHttp('Firefox/142');
      const second = await loginViaHttp('Safari/26');

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', first.cookie)
        .expect(204);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', second.cookie)
        .expect(200);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('signs out every device at once, including the caller', async () => {
      const first = await loginViaHttp('Firefox/142');
      const second = await loginViaHttp('Safari/26');

      const logout = await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Cookie', first.cookie)
        .expect(204);
      expect(setCookiesOf(logout)[0]).toContain('Max-Age=0');

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', first.cookie)
        .expect(401);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', second.cookie)
        .expect(401);
    });
  });

  describe('GET /auth/sessions', () => {
    it('returns 401 with no cookie', async () => {
      await request(app.getHttpServer()).get('/auth/sessions').expect(401);
    });

    it('lists the caller’s live sessions, most recent first, marking the current one', async () => {
      const older = await loginViaHttp('Firefox/142');
      await loginViaHttp('Safari/26');

      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Cookie', older.cookie)
        .expect(200);

      const listed = listOf(response);
      expect(listed).toHaveLength(2);
      // The caller's own session was just touched by this very request, so it
      // is the most recently seen and comes first.
      expect(listed[0]).toMatchObject({
        userAgent: 'Firefox/142',
        current: true,
      });
      expect(listed[1]).toMatchObject({
        userAgent: 'Safari/26',
        current: false,
      });
      expect(listed[0]).toEqual({
        id: expect.any(String) as string,
        userAgent: 'Firefox/142',
        ipAddress: expect.any(String) as string,
        createdAt: expect.any(String) as string,
        lastSeenAt: expect.any(String) as string,
        current: true,
      });
    });

    it('leaves a session out once it has been logged out', async () => {
      const mine = await loginViaHttp('Firefox/142');
      const other = await loginViaHttp('Safari/26');
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', other.cookie)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Cookie', mine.cookie)
        .expect(200);

      expect(listOf(response).map((row) => row.userAgent)).toEqual([
        'Firefox/142',
      ]);
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    const OTHER_USER_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

    const idOfOtherDevice = async (cookie: string): Promise<string> => {
      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Cookie', cookie)
        .expect(200);
      const other = listOf(response).find((row) => row.current === false);
      if (!other?.id) {
        throw new Error('Expected a second, non-current session.');
      }
      return other.id;
    };

    it('returns 204 and the revoked device answers 401 afterwards', async () => {
      const mine = await loginViaHttp('Firefox/142');
      const other = await loginViaHttp('Safari/26');
      const otherId = await idOfOtherDevice(mine.cookie);

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${otherId}`)
        .set('Cookie', mine.cookie)
        .expect(204);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', other.cookie)
        .expect(401);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', mine.cookie)
        .expect(200);
    });

    it('clears the cookie when the caller revokes the session it is calling from', async () => {
      const mine = await loginViaHttp('Firefox/142');
      const me = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Cookie', mine.cookie)
        .expect(200);
      const myId = listOf(me).find((row) => row.current)?.id ?? '';

      const response = await request(app.getHttpServer())
        .delete(`/auth/sessions/${myId}`)
        .set('Cookie', mine.cookie)
        .expect(204);

      const [cleared, ...rest] = setCookiesOf(response);
      expect(rest).toEqual([]);
      expect(cleared).toContain('Max-Age=0');
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', mine.cookie)
        .expect(401);
    });

    it('answers 404 for another user’s session, and leaves it live', async () => {
      // The first ownership rule in this API, enforced by the repository
      // predicate rather than a comparison in a handler; see ADR 0015.
      const mine = await loginViaHttp('Firefox/142');
      const theirs = await seedSessionCookie(sessions, {
        userId: OTHER_USER_ID,
        role: 'customer',
      });

      const response = await request(app.getHttpServer())
        .delete(`/auth/sessions/${theirs.sessionId}`)
        .set('Cookie', mine.cookie)
        .expect(404);

      expect(bodyOf(response).code).toBe('AUTH_SESSION_NOT_FOUND');
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', theirs.cookie)
        .expect(200);
    });

    it('answers 404 for an id nobody holds, identically', async () => {
      const mine = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .delete('/auth/sessions/3f2504e0-4f89-11d3-9a0c-0305e82c3301')
        .set('Cookie', mine.cookie)
        .expect(404);

      expect(bodyOf(response).code).toBe('AUTH_SESSION_NOT_FOUND');
    });

    it('answers 400 for a malformed id, before any lookup', async () => {
      const mine = await loginViaHttp();

      await request(app.getHttpServer())
        .delete('/auth/sessions/not-a-uuid')
        .set('Cookie', mine.cookie)
        .expect(400);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('returns 202 for a known address', async () => {
      credentials.seed({
        userId: USER_ID,
        email: 'ada@example.com',
        role: 'seller',
        passwordHash: 'hash-1',
        emailVerifiedAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'ada@example.com' })
        .expect(202);
    });

    it('returns 202 for an address nobody holds, since the endpoint answers the same either way', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(202);
    });
  });

  describe('POST /auth/reset-password', () => {
    const seedResetToken = async (
      expiresAt: Date,
    ): Promise<{ plaintext: string }> => {
      const hash = await hasher.hash(Password.create('correct horse battery'));
      credentials.seed({
        userId: USER_ID,
        email: 'ada@example.com',
        role: 'seller',
        passwordHash: hash.value,
        emailVerifiedAt: new Date(),
      });
      const secret = SecretToken.issue();
      await tokens.issue({
        id: OneTimeTokenId.create(),
        purpose: TokenPurpose.passwordReset(),
        userId: UserId.create(USER_ID),
        tokenHash: secret.hash,
        expiresAt,
      });

      return { plaintext: secret.plaintext };
    };

    it('returns 204 for a good token, and the old password stops working at login', async () => {
      const { plaintext } = await seedResetToken(new Date(Date.now() + 60_000));

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: plaintext, newPassword: 'a new long password' })
        .expect(204);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'correct horse battery' })
        .expect(401);
      expect(bodyOf(response).code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('signs out every session the account had', async () => {
      const { cookie } = await loginViaHttp();
      const { plaintext } = await seedResetToken(new Date(Date.now() + 60_000));

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: plaintext, newPassword: 'a new long password' })
        .expect(204);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('returns 401 with a typed code for an expired token', async () => {
      const { plaintext } = await seedResetToken(new Date(Date.now() - 1000));

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: plaintext, newPassword: 'a new long password' })
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_RESET_TOKEN_EXPIRED');
    });

    it('returns 422 with a typed code for a weak new password', async () => {
      const { plaintext } = await seedResetToken(new Date(Date.now() + 60_000));

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: plaintext, newPassword: 'short' })
        .expect(422);

      expect(bodyOf(response).code).toBe('USER_PASSWORD_INVALID');
    });
  });

  describe('POST /auth/change-password', () => {
    it('returns 401 with no cookie, since the endpoint is protected', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({
          currentPassword: 'whatever',
          newPassword: 'a new long password',
        })
        .expect(401);
    });

    it('returns 401 with a typed code for a wrong current password', async () => {
      const { cookie } = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'wrong', newPassword: 'a new long password' })
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 204 for the right current password', async () => {
      const { cookie } = await loginViaHttp();

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'correct horse battery',
          newPassword: 'a new long password',
        })
        .expect(204);
    });

    it('keeps the caller signed in and signs out every other device', async () => {
      const mine = await loginViaHttp('Firefox/142');
      const other = await loginViaHttp('Safari/26');

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Cookie', mine.cookie)
        .send({
          currentPassword: 'correct horse battery',
          newPassword: 'a new long password',
        })
        .expect(204);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', mine.cookie)
        .expect(200);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', other.cookie)
        .expect(401);
    });
  });
});
