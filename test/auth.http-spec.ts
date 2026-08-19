import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  ACCESS_TOKEN_ISSUER,
  CREDENTIAL_REPOSITORY,
  EMAIL_SENDER,
  ONE_TIME_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_LIFETIMES,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from '@/identity/application';
import { IdentityModule } from '@/identity/identity.module';
import {
  OneTimeTokenId,
  Password,
  SecretToken,
  TokenPurpose,
  UserId,
} from '@/identity/domain';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { RecordingEmailSender } from '@test/fakes/recording-email.sender';

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

interface ResponseBody {
  code?: string;
  accessToken?: string;
  tokenType?: string;
  refreshToken?: string;
}

const bodyOf = (response: request.Response): ResponseBody =>
  response.body as ResponseBody;

// No Authorization header anywhere below: login, verify-email, and
// verify-email/resend are all marked @Public() (auth.controller.ts), since a
// client cannot hold a token before any of them succeeds.
describe('auth HTTP contract', () => {
  let app: INestApplication<App>;
  let tokens: InMemoryOneTimeTokenRepository;
  let credentials: InMemoryCredentialRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let hasher: FakePasswordHasher;

  beforeEach(async () => {
    const writes = new InMemoryUserWriteRepository();
    tokens = new InMemoryOneTimeTokenRepository();
    credentials = new InMemoryCredentialRepository();
    refreshTokens = new InMemoryRefreshTokenRepository();
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
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(refreshTokens)
      .overrideProvider(ACCESS_TOKEN_ISSUER)
      .useValue(new FakeAccessTokenIssuer())
      .overrideProvider(TOKEN_LIFETIMES)
      .useValue({
        refreshTokenDays: 30,
        passwordResetMinutes: 60,
        emailVerificationHours: 24,
      })
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Shared by the refresh, logout, and logout-all suites below: each needs a
  // real session minted through the actual login endpoint, not seeded
  // directly, since what is under test is how the session responds to being
  // presented back to the API.
  const loginViaHttp = async (): Promise<{
    accessToken: string;
    refreshToken: string;
  }> => {
    const hash = await hasher.hash(Password.create('correct horse battery'));
    credentials.seed({
      userId: USER_ID,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: hash.value,
      emailVerifiedAt: new Date(),
    });
    // The fake models no `users` table, so `rotate` cannot join for a role;
    // this seam stands in for that join.
    refreshTokens.seedUserRole(USER_ID, 'seller');

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'correct horse battery' })
      .expect(200);

    const body = bodyOf(response);
    return {
      accessToken: body.accessToken as string,
      refreshToken: body.refreshToken as string,
    };
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

    it('returns 200 with a bearer session for good credentials', async () => {
      await seedAccount();

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'correct horse battery' })
        .expect(200);

      const body = bodyOf(response);
      expect(body.tokenType).toBe('Bearer');
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
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

  describe('POST /auth/refresh', () => {
    it('returns 200 with a refresh token different from the one presented', async () => {
      const { refreshToken } = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(bodyOf(response).refreshToken).toEqual(expect.any(String));
      expect(bodyOf(response).refreshToken).not.toBe(refreshToken);
    });

    it('answers a replayed refresh token, and the successor it issued before dying, both with 401', async () => {
      const { refreshToken } = await loginViaHttp();

      const rotated = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const replay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      expect(bodyOf(replay).code).toBe('AUTH_REFRESH_TOKEN_INVALID');

      // The point of revoking the chain rather than the token: the successor,
      // never presented by an attacker, is dead too.
      const successor = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: bodyOf(rotated).refreshToken })
        .expect(401);
      expect(bodyOf(successor).code).toBe('AUTH_REFRESH_TOKEN_INVALID');
    });

    it('does not throttle refresh, which neither hashes nor mails', async () => {
      // 20 exceeds every limit set elsewhere in this file (10 or 5), so a
      // 429 here would prove a limit leaked onto this route rather than
      // proving anything about refresh itself.
      for (let i = 0; i < 20; i += 1) {
        await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken: 'not-a-real-token' })
          .expect(401);
      }
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 401 with no access token, since the endpoint is protected', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('returns 204 and revokes the session, so its refresh token stops working', async () => {
      const { accessToken, refreshToken } = await loginViaHttp();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      expect(bodyOf(response).code).toBe('AUTH_REFRESH_TOKEN_INVALID');
    });
  });

  describe('POST /auth/logout-all', () => {
    it('returns 204', async () => {
      const { accessToken } = await loginViaHttp();

      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
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
    it('returns 401 with no access token, since the endpoint is protected', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({
          currentPassword: 'whatever',
          newPassword: 'a new long password',
        })
        .expect(401);
    });

    it('returns 401 with a typed code for a wrong current password', async () => {
      const { accessToken } = await loginViaHttp();

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'wrong', newPassword: 'a new long password' })
        .expect(401);

      expect(bodyOf(response).code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 204 for the right current password', async () => {
      const { accessToken } = await loginViaHttp();

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'correct horse battery',
          newPassword: 'a new long password',
        })
        .expect(204);
    });
  });
});
