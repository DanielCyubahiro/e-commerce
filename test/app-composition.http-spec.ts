import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import { AppModule } from '@/app.module';
import { ACCESS_TOKEN_ISSUER } from '@/identity/application';
import { UNIT_OF_WORK } from '@/shared/application';
import { MongoModule } from '@/shared/infrastructure/database/mongo/mongo.module';
import { MONGO_DB } from '@/shared/infrastructure/database/mongo/mongo.provider';
import { DrizzleModule } from '@/shared/infrastructure/database/postgres/drizzle.module';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';

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
  let customerToken: string;

  beforeAll(async () => {
    // OrderingModule has no public route, unlike CatalogueModule's two GETs,
    // so reaching it here needs a real token. IdentityModule's own
    // ACCESS_TOKEN_ISSUER is a real jose signer keyed off config secrets;
    // overriding it with the fake is the one provider swap this suite makes
    // on top of the two whole-module replacements, and it does not touch
    // either existing claim: JwtAuthGuard still comes from IdentityModule,
    // still runs as APP_GUARD, and still reads whatever ACCESS_TOKEN_ISSUER
    // resolves to.
    const issuer = new FakeAccessTokenIssuer();
    customerToken = `Bearer ${
      (
        await issuer.issue({
          userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          role: 'customer',
          sessionId: '9c858901-8a57-4791-81fe-4c455b099bc9',
        })
      ).token
    }`;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(MongoModule)
      .useModule(NoopMongoModule)
      .overrideModule(DrizzleModule)
      .useModule(NoopDrizzleModule)
      .overrideProvider(ACCESS_TOKEN_ISSUER)
      .useValue(issuer)
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
    );
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reaches a CatalogueModule endpoint through the guard IdentityModule registers globally', async () => {
    await request(app.getHttpServer()).get('/products').expect(200);
  });

  it('still guards a CatalogueModule endpoint with no token', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .send({});

    expect(response.status).toBe(401);
  });

  it('reaches an OrderingModule endpoint through the same guard, given a valid token', async () => {
    await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', customerToken)
      .expect(200);
  });

  it('still guards an OrderingModule endpoint with no token', async () => {
    const response = await request(app.getHttpServer()).get('/orders');

    expect(response.status).toBe(401);
  });
});
