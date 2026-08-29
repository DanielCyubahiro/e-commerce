import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import { AppModule } from '@/app.module';
import { SESSION_REPOSITORY } from '@/identity/application';
import { UNIT_OF_WORK } from '@/shared/application';
import { MongoModule } from '@/shared/infrastructure/database/mongo/mongo.module';
import { MONGO_DB } from '@/shared/infrastructure/database/mongo/mongo.provider';
import { DrizzleModule } from '@/shared/infrastructure/database/postgres/drizzle.module';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { seedSessionCookie } from '@test/support/session-cookie';

/**
 * Every other http-spec assembles its own subset of providers by hand, which
 * proves each context's own wiring but never that AppModule's actual graph
 * holds together. Two claims rest on framework semantics plus those
 * hand-wired doubles until something builds the real module tree: that
 * `APP_GUARD`, registered inside IdentityModule, actually reaches a
 * CatalogueModule controller, and that ThrottlerModule's `@Global()`
 * registration inside IdentityModule is visible app-wide. This suite builds
 * AppModule itself and exercises the first claim directly; the second is
 * implied by the same graph compiling with both modules present.
 *
 * MongoModule and DrizzleModule are replaced wholesale rather than having a
 * provider inside them overridden: MongoClientProvider connects a real client
 * at construction, and this suite runs with no container up.
 */

// Every property access on the chain returns a function that returns the
// chain itself, so any `.from()/.where()/...` call this suite drives
// resolves; the `then` trap is what makes `await`-ing the chain settle,
// always with an empty result set.
//
// The root handle (what `select()` returns from) deliberately does not carry
// that `then` trap itself: Nest's DI awaits any injected value shaped like a
// thenable before handing it to a constructor, which would collapse the whole
// handle to the chain's own empty result before a repository ever saw it.
const ALLOWED_ORIGIN = 'http://localhost:5173';

// Only the session lifetimes matter here; the fake's `touch` reads them.
const lifetimes = {
  passwordResetMinutes: 60,
  emailVerificationHours: 24,
  sessionIdleDays: 30,
  sessionAbsoluteDays: 365,
};

function emptyDrizzleDouble(): DrizzleDB {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (rows: unknown[]) => void) => resolve([]);
      }
      return () => chain;
    },
  };
  const chain: object = new Proxy({}, handler);
  return { select: () => chain } as unknown as DrizzleDB;
}

@Global()
@Module({
  providers: [{ provide: MONGO_DB, useValue: {} }],
  exports: [MONGO_DB],
})
class NoopMongoModule {}

// OrderingModule's PlaceOrderHandler and CancelOrderHandler inject
// UNIT_OF_WORK; Nest instantiates every provider at module bootstrap, so
// this stub has to satisfy that dependency even though no test here reaches
// a route that calls `run`.
@Global()
@Module({
  providers: [
    { provide: DRIZZLE, useValue: emptyDrizzleDouble() },
    { provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork([]) },
  ],
  exports: [DRIZZLE, UNIT_OF_WORK],
})
class NoopDrizzleModule {}

describe('AppModule composition', () => {
  let app: INestApplication<App>;
  let customerCookie: string;

  beforeAll(async () => {
    // OrderingModule has no public route, unlike CatalogueModule's two GETs,
    // so reaching it here needs a live session. IdentityModule's own
    // SESSION_REPOSITORY is the Drizzle adapter over the empty double above;
    // swapping it for the in-memory fake is the one provider override this
    // suite makes on top of the two whole-module replacements, and it does
    // not touch either existing claim: SessionAuthGuard still comes from
    // IdentityModule, still runs as APP_GUARD, and still resolves the cookie
    // through whatever SESSION_REPOSITORY holds.
    const sessions = new InMemorySessionRepository(lifetimes);
    ({ cookie: customerCookie } = await seedSessionCookie(sessions, {
      userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      role: 'customer',
    }));

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(MongoModule)
      .useModule(NoopMongoModule)
      .overrideModule(DrizzleModule)
      .useModule(NoopDrizzleModule)
      .overrideProvider(SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
      { allowedOrigin: ALLOWED_ORIGIN },
    );
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reaches a CatalogueModule endpoint through the guard IdentityModule registers globally', async () => {
    await request(app.getHttpServer()).get('/products').expect(200);
  });

  it('still guards a CatalogueModule endpoint with no cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .send({});

    expect(response.status).toBe(401);
  });

  it('reaches an OrderingModule endpoint through the same guard, given a live cookie', async () => {
    await request(app.getHttpServer())
      .get('/orders')
      .set('Cookie', customerCookie)
      .expect(200);
  });

  it('still guards an OrderingModule endpoint with no cookie', async () => {
    const response = await request(app.getHttpServer()).get('/orders');

    expect(response.status).toBe(401);
  });
});
