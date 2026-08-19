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
  TOKEN_LIFETIMES,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from '@/identity/application';
import { IdentityModule } from '@/identity/identity.module';
import {
  OneTimeTokenId,
  SecretToken,
  TokenPurpose,
  UserId,
} from '@/identity/domain';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { RecordingEmailSender } from '@test/fakes/recording-email.sender';

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

interface ResponseBody {
  code?: string;
}

const bodyOf = (response: request.Response): ResponseBody =>
  response.body as ResponseBody;

describe('auth HTTP contract', () => {
  let app: INestApplication<App>;
  let tokens: InMemoryOneTimeTokenRepository;
  let credentials: InMemoryCredentialRepository;

  beforeEach(async () => {
    const writes = new InMemoryUserWriteRepository();
    tokens = new InMemoryOneTimeTokenRepository();
    credentials = new InMemoryCredentialRepository();

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
      .useValue(new FakePasswordHasher())
      .overrideProvider(EMAIL_SENDER)
      .useValue(new RecordingEmailSender())
      .overrideProvider(CREDENTIAL_REPOSITORY)
      .useValue(credentials)
      .overrideProvider(ONE_TIME_TOKEN_REPOSITORY)
      .useValue(tokens)
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
});
