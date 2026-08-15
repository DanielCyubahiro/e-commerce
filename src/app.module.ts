import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { validateEnv } from '@/config/env.schema';
import { MongoModule } from './shared/infrastructure/database/mongo/mongo.module';
import { DrizzleModule } from './shared/infrastructure/database/postgres/drizzle.module';
import { ProductModule } from './product/product.module';

/**
 * `validate: validateEnv` is what makes a malformed environment abort at
 * boot rather than fail later at first use, and `isGlobal: true` is why no
 * other module imports `ConfigModule` for itself.
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
    ProductModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
