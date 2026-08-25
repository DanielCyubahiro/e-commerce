import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { validateEnv } from '@/config/env.schema';
import { MongoModule } from './shared/infrastructure/database/mongo/mongo.module';
import { DrizzleModule } from './shared/infrastructure/database/postgres/drizzle.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { IdentityModule } from './identity/identity.module';
import { OrderingModule } from './ordering/ordering.module';

/**
 * `validate: validateEnv` is what makes a malformed environment abort at
 * boot rather than fail later at first use, and `isGlobal: true` is why no
 * other module imports `ConfigModule` for itself.
 *
 * `ThrottlerModule` is registered in `identity.module.ts`, not here, even
 * though it is `@Global()` like `ConfigModule`: every http-spec test
 * bootstraps `IdentityModule` on its own, without this module, and a guard
 * applied via `@UseGuards()` cannot be swapped out with `overrideProvider`
 * the way the config-backed providers below are. Registering it where the
 * guarded controllers live is what the existing `JwtAuthGuard` /
 * `APP_GUARD` pairing in `identity.module.ts` already does for the same
 * reason.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    MongoModule,
    DrizzleModule,
    CqrsModule,
    CatalogueModule,
    IdentityModule,
    OrderingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
