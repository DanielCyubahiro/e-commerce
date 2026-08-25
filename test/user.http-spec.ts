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
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { RecordingEmailSender } from '@test/fakes/recording-email.sender';
import { seedSessionCookie } from '@test/support/session-cookie';

const MISSING_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const ALLOWED_ORIGIN = 'http://localhost:5173';

const lifetimes = {
  passwordResetMinutes: 60,
  emailVerificationHours: 24,
  sessionIdleDays: 30,
  sessionAbsoluteDays: 365,
};

interface ResponseBody {
  id?: string;
  code?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: { email: string }[];
  total?: number;
  limit?: number;
  offset?: number;
}

const bodyOf = (response: request.Response): ResponseBody =>
  response.body as ResponseBody;

const validBody = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'seller',
  password: 'correct horse battery',
  ...overrides,
});

/** No `email`: it is immutable after registration, so `PUT` never accepts it. */
const updateBody = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'seller',
  ...overrides,
});

describe('users HTTP contract', () => {
  let app: INestApplication<App>;
  let authCookie: string;

  beforeEach(async () => {
    const writes = new InMemoryUserWriteRepository();
    const sessions = new InMemorySessionRepository(lifetimes);

    // The providers `identity.module.ts` binds via `useFactory` or a Drizzle
    // adapter need `ConfigService`, or reach a real Postgres/SMTP connection
    // through `DRIZZLE`. This suite imports only `IdentityModule`, not
    // `AppModule`, so none of that is available; every one is overridden with
    // the same fakes the unit suites use. `IdentityModule` already registers
    // `SessionAuthGuard` as `APP_GUARD` (identity.module.ts), so this suite
    // need not wire the guard again, only override the session repository it
    // resolves through.
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
      .useValue(new InMemoryCredentialRepository())
      .overrideProvider(ONE_TIME_TOKEN_REPOSITORY)
      .useValue(new InMemoryOneTimeTokenRepository())
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

    ({ cookie: authCookie } = await seedSessionCookie(sessions, {
      userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      role: 'seller',
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  const create = (overrides: Record<string, unknown> = {}): request.Test =>
    request(app.getHttpServer()).post('/users').send(validBody(overrides));

  const get = (path: string): request.Test =>
    request(app.getHttpServer()).get(path).set('Cookie', authCookie);

  const put = (path: string, body: Record<string, unknown>): request.Test =>
    request(app.getHttpServer()).put(path).set('Cookie', authCookie).send(body);

  const del = (path: string): request.Test =>
    request(app.getHttpServer()).delete(path).set('Cookie', authCookie);

  describe('POST /users', () => {
    it('returns 201 with the new id and a Location header', async () => {
      const response = await create().expect(201);

      expect(bodyOf(response).id).toEqual(expect.any(String));
      expect(response.headers.location).toBe(`/users/${bodyOf(response).id}`);
    });

    it('returns 400 when a required field is missing', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ firstName: 'Ada' })
        .expect(400);
    });

    it('returns 400 for an unknown property', async () => {
      // `create(...)` does not itself match the `request.**.expect` pattern
      // jest/expect-expect looks for, so the status is asserted explicitly.
      expect((await create({ nickname: 'Ada' })).status).toBe(400);
    });

    it('returns 422 with a typed code for a malformed email', async () => {
      const response = await create({ email: 'nope' }).expect(422);

      expect(bodyOf(response).code).toBe('USER_EMAIL_INVALID');
    });

    it('returns 422 for a role outside the closed set', async () => {
      const response = await create({ role: 'admin' }).expect(422);

      expect(bodyOf(response).code).toBe('USER_ROLE_INVALID');
    });

    it('returns 422 for a malformed phone', async () => {
      const response = await create({ phone: '0489123456' }).expect(422);

      expect(bodyOf(response).code).toBe('USER_PHONE_INVALID');
    });

    it('returns 400 when the password is missing', async () => {
      // JSON.stringify drops an `undefined`-valued key, so this sends a body
      // with no `password` at all, the same as an absent key from a client.
      // `create(...)` does not itself match the `request.**.expect` pattern
      // jest/expect-expect looks for, so the status is asserted explicitly.
      expect((await create({ password: undefined })).status).toBe(400);
    });

    it('returns 422 with a typed code for a password below the minimum length', async () => {
      const response = await create({ password: '12345678901' }).expect(422);

      expect(bodyOf(response).code).toBe('USER_PASSWORD_INVALID');
    });

    it('accepts an explicit null phone the same as an absent key', async () => {
      // `@IsOptional` short-circuits validation for both an absent key and an
      // explicit JSON `null`; the absent-key path is covered by GET's "null
      // phone" test, so this covers the other half of that claim.
      const created = await create({ phone: null }).expect(201);

      const response = await get(`/users/${bodyOf(created).id}`).expect(200);

      expect(bodyOf(response).phone).toBeNull();
    });

    it('returns 409 for a duplicate email, case-insensitively', async () => {
      await create().expect(201);

      const response = await create({ email: 'ADA@Example.com' }).expect(409);

      expect(bodyOf(response).code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('throttles repeated registration attempts', async () => {
      // Distinct emails per call: a repeat would answer 409 from the handler,
      // which would leave this test unable to tell a real 429 from the
      // limiter apart from one that never ran because the guard sits ahead of
      // it either way.
      for (let i = 0; i < 5; i += 1) {
        await create({ email: `user-${i}@example.com` }).expect(201);
      }

      const response = await create({ email: 'user-5@example.com' }).expect(
        429,
      );
      expect(bodyOf(response).code).toBeUndefined();
    });
  });

  describe('GET /users/:id', () => {
    it('returns every stored field, with a null phone rather than an absent key', async () => {
      const created = await create().expect(201);
      const id = bodyOf(created).id;

      const response = await get(`/users/${id}`).expect(200);

      expect(bodyOf(response)).toMatchObject({
        id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'seller',
        phone: null,
      });
      expect(Object.keys(response.body as object)).toContain('phone');
      expect(bodyOf(response).createdAt).toEqual(expect.any(String));
      expect(bodyOf(response).updatedAt).toEqual(expect.any(String));
    });

    it('returns 400 for a malformed id', async () => {
      expect((await get('/users/not-a-uuid')).status).toBe(400);
    });

    it('returns 404 when no user holds the id', async () => {
      const response = await get(`/users/${MISSING_ID}`).expect(404);

      expect(bodyOf(response).code).toBe('USER_NOT_FOUND');
    });
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      await create().expect(201);
      await create({ email: 'grace@example.com', role: 'customer' }).expect(
        201,
      );
    });

    it('returns a pagination envelope with defaults applied', async () => {
      const response = await get('/users').expect(200);

      expect(bodyOf(response).total).toBe(2);
      expect(bodyOf(response).limit).toBe(20);
      expect(bodyOf(response).offset).toBe(0);
    });

    it('filters by role', async () => {
      const response = await get('/users?role=customer').expect(200);

      expect(bodyOf(response).items?.map((item) => item.email)).toEqual([
        'grace@example.com',
      ]);
    });

    it('answers 422 for a mistyped role rather than an empty page', async () => {
      const response = await get('/users?role=selller').expect(422);

      expect(bodyOf(response).code).toBe('USER_ROLE_INVALID');
    });

    it('rejects a limit above the maximum at the edge', async () => {
      expect((await get('/users?limit=1000')).status).toBe(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('returns 204 and clears a phone the payload omits', async () => {
      const created = await create({ phone: '+32489123456' }).expect(201);
      const id = bodyOf(created).id;

      const beforePut = await get(`/users/${id}`).expect(200);
      // Proves there is a phone to clear, so "cleared" below cannot pass
      // vacuously against a user that never had one.
      expect(bodyOf(beforePut).phone).toBe('+32489123456');

      await put(`/users/${id}`, updateBody({ firstName: 'Grace' })).expect(204);

      const response = await get(`/users/${id}`).expect(200);
      expect(bodyOf(response)).toMatchObject({
        firstName: 'Grace',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'seller',
        phone: null,
      });
    });

    it('returns 404 when no user holds the id', async () => {
      expect((await put(`/users/${MISSING_ID}`, updateBody())).status).toBe(
        404,
      );
    });

    it('returns 422 for a broken invariant even when the id holds nothing', async () => {
      const response = await put(
        `/users/${MISSING_ID}`,
        updateBody({ role: 'admin' }),
      ).expect(422);

      expect(bodyOf(response).code).toBe('USER_ROLE_INVALID');
    });

    it('returns 400 when the payload carries an email, since it is immutable after registration', async () => {
      const created = await create().expect(201);
      const id = bodyOf(created).id;

      expect(
        (await put(`/users/${id}`, updateBody({ email: 'new@example.com' })))
          .status,
      ).toBe(400);
    });
  });

  describe('DELETE /users/:id', () => {
    it('returns 204 and removes the user', async () => {
      const created = await create().expect(201);
      const id = bodyOf(created).id;

      expect((await del(`/users/${id}`)).status).toBe(204);
      expect((await get(`/users/${id}`)).status).toBe(404);
    });

    it('returns 404 when no user holds the id', async () => {
      expect((await del(`/users/${MISSING_ID}`)).status).toBe(404);
    });
  });

  it('refuses a protected endpoint with no cookie', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('answers 401 rather than 400 when a missing cookie meets a malformed body', async () => {
    // Asserts the guard-before-pipe ordering documented on SessionAuthGuard: a
    // ValidationPipe running first would answer 400 for the unknown property
    // before the guard ever saw the missing cookie.
    const response = await request(app.getHttpServer())
      .put(`/users/${MISSING_ID}`)
      .send({ nickname: 'Ada' })
      .expect(401);

    expect(bodyOf(response).code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('leaves the public endpoints reachable without a cookie', async () => {
    expect((await create()).status).toBe(201);
  });
});
