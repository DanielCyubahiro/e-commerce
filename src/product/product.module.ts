import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  commandHandlers,
  PRODUCT_READ_REPOSITORY,
  PRODUCT_WRITE_REPOSITORY,
  queryHandlers,
} from './application';
import {
  DrizzleProductReadRepository,
  DrizzleProductWriteRepository,
} from './infrastructure';
import { ProductController } from './presentation/product.controller';

/**
 * `PRODUCT_READ_REPOSITORY` and `PRODUCT_WRITE_REPOSITORY` bind the ports to
 * their adapters. Swapping the `useClass` pair here is the last of several
 * fork steps, not the whole thing: the adapters inject `DRIZZLE`, which this
 * module does not provide, so a fork still needs its own client and token
 * wired into an `@Global()` module registered in src/app.module.ts. See the
 * fork seam in docs/architecture.md.
 */
@Module({
  imports: [CqrsModule],
  controllers: [ProductController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    {
      provide: PRODUCT_WRITE_REPOSITORY,
      useClass: DrizzleProductWriteRepository,
    },
    {
      provide: PRODUCT_READ_REPOSITORY,
      useClass: DrizzleProductReadRepository,
    },
  ],
})
export class ProductModule {}
