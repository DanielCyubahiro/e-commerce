import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import { AppModule } from '@/app.module';
import { MongoModule } from '@/shared/infrastructure/database/mongo/mongo.module';
import { MONGO_DB } from '@/shared/infrastructure/database/mongo/mongo.provider';
import { DrizzleModule } from '@/shared/infrastructure/database/postgres/drizzle.module';
import {
  DRIZZLE,
  type DrizzleDB,
} from '@/shared/infrastructure/database/postgres/drizzle.provider';

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

@Global()
@Module({
  providers: [{ provide: DRIZZLE, useValue: emptyDrizzleDouble() }],
  exports: [DRIZZLE],
})
class NoopDrizzleModule {}

describe('AppModule composition', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(MongoModule)
      .useModule(NoopMongoModule)
      .overrideModule(DrizzleModule)
      .useModule(NoopDrizzleModule)
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
});
