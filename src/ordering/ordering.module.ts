import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CatalogueModule } from '@/catalogue/catalogue.module';
import {
  commandHandlers,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
  queryHandlers,
} from './application';
import {
  DrizzleOrderReadRepository,
  DrizzleOrderWriteRepository,
} from './infrastructure';
import { OrderController } from './presentation/order.controller';

/**
 * Binds the two ordering ports to their adapters. The two collaborators this
 * context does not own arrive from elsewhere: `STOCK_ALLOCATOR` is what
 * `CatalogueModule` exports (its published interface), and `UNIT_OF_WORK`
 * comes from the `@Global()` DrizzleModule in src/app.module.ts, as `DRIZZLE`
 * does for the adapters. See the fork seam in docs/architecture.md.
 */
@Module({
  imports: [CqrsModule, CatalogueModule],
  controllers: [OrderController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: ORDER_WRITE_REPOSITORY, useClass: DrizzleOrderWriteRepository },
    { provide: ORDER_READ_REPOSITORY, useClass: DrizzleOrderReadRepository },
  ],
})
export class OrderingModule {}
