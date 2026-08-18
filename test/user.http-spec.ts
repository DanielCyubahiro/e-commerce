import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from '@/user/application';
import { UserModule } from '@/user/user.module';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';

const MISSING_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

interface ResponseBody {
  id?: string;
  code?: string;
  email?: string;
  firstName?: string;
  role?: string;
  phone?: string | null;
  createdAt?: string;
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
  ...overrides,
});

describe('users HTTP contract', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const writes = new InMemoryUserWriteRepository();

    const moduleRef = await Test.createTestingModule({ imports: [UserModule] })
      .overrideProvider(USER_WRITE_REPOSITORY)
      .useValue(writes)
      .overrideProvider(USER_READ_REPOSITORY)
      .useValue(new InMemoryUserReadRepository(writes))
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const create = (overrides: Record<string, unknown> = {}): request.Test =>
    request(app.getHttpServer()).post('/users').send(validBody(overrides));

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

    it('returns 409 for a duplicate email, case-insensitively', async () => {
      await create().expect(201);

      const response = await create({ email: 'ADA@Example.com' }).expect(409);

      expect(bodyOf(response).code).toBe('USER_EMAIL_DUPLICATE');
    });
  });

  describe('GET /users/:id', () => {
    it('returns the user with a null phone rather than an absent key', async () => {
      const created = await create().expect(201);

      const response = await request(app.getHttpServer())
        .get(`/users/${bodyOf(created).id}`)
        .expect(200);

      expect(bodyOf(response).phone).toBeNull();
      expect(Object.keys(response.body as object)).toContain('phone');
      expect(bodyOf(response).createdAt).toEqual(expect.any(String));
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer()).get('/users/not-a-uuid').expect(400);
    });

    it('returns 404 when no user holds the id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${MISSING_ID}`)
        .expect(404);

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
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(bodyOf(response).total).toBe(2);
      expect(bodyOf(response).limit).toBe(20);
      expect(bodyOf(response).offset).toBe(0);
    });

    it('filters by role', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?role=customer')
        .expect(200);

      expect(bodyOf(response).items?.map((item) => item.email)).toEqual([
        'grace@example.com',
      ]);
    });

    it('answers 422 for a mistyped role rather than an empty page', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?role=selller')
        .expect(422);

      expect(bodyOf(response).code).toBe('USER_ROLE_INVALID');
    });

    it('rejects a limit above the maximum at the edge', async () => {
      await request(app.getHttpServer()).get('/users?limit=1000').expect(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('returns 204 and clears a phone the payload omits', async () => {
      const created = await create({ phone: '+32489123456' }).expect(201);
      const id = bodyOf(created).id;

      await request(app.getHttpServer())
        .put(`/users/${id}`)
        .send(validBody({ firstName: 'Grace' }))
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/users/${id}`)
        .expect(200);
      expect(bodyOf(response).firstName).toBe('Grace');
      expect(bodyOf(response).phone).toBeNull();
    });

    it('returns 404 when no user holds the id', async () => {
      await request(app.getHttpServer())
        .put(`/users/${MISSING_ID}`)
        .send(validBody())
        .expect(404);
    });

    it('returns 422 for a broken invariant even when the id holds nothing', async () => {
      const response = await request(app.getHttpServer())
        .put(`/users/${MISSING_ID}`)
        .send(validBody({ role: 'admin' }))
        .expect(422);

      expect(bodyOf(response).code).toBe('USER_ROLE_INVALID');
    });
  });

  describe('DELETE /users/:id', () => {
    it('returns 204 and removes the user', async () => {
      const created = await create().expect(201);
      const id = bodyOf(created).id;

      await request(app.getHttpServer()).delete(`/users/${id}`).expect(204);
      await request(app.getHttpServer()).get(`/users/${id}`).expect(404);
    });

    it('returns 404 when no user holds the id', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${MISSING_ID}`)
        .expect(404);
    });
  });
});
