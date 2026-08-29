import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  commandHandlers,
  PRODUCT_READ_REPOSITORY,
  PRODUCT_WRITE_REPOSITORY,
  queryHandlers,
  STOCK_ALLOCATOR,
} from './application';
import {
  DrizzleProductReadRepository,
  DrizzleProductWriteRepository,
  DrizzleStockAllocator,
} from './infrastructure';
import { ProductController } from './presentation/product.controller';

/**
 * `PRODUCT_READ_REPOSITORY` and `PRODUCT_WRITE_REPOSITORY` bind the ports to
 * their adapters. Swapping the `useClass` pair here is the last of several
 * fork steps, not the whole thing: the adapters inject `DRIZZLE`, which this
 * module does not provide, so a fork still needs its own client and token
 * wired into an `@Global()` module registered in src/app.module.ts. See the
 * fork seam in docs/architecture.md.
 *
 * `STOCK_ALLOCATOR` is the one token this module exports: it is catalogue's
 * published interface, consumed by `OrderingModule`.
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
    {
      provide: STOCK_ALLOCATOR,
      useClass: DrizzleStockAllocator,
    },
  ],
  exports: [STOCK_ALLOCATOR],
})
export class CatalogueModule {}
