import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import {
  commandHandlers,
  PRODUCT_WRITE_REPOSITORY,
  queryHandlers,
} from './application';
import { PRODUCT_REPOSITORY } from './application/ports/product.repository';
import { DrizzleProductWriteRepository } from './infrastructure';
import { DrizzleProductRepository } from './infrastructure/adapters/drizzle-product.repository';
import { ProductController } from './presentation/product.controller';

// PRODUCT_REPOSITORY still serves the two query handlers. Task 8 replaces it
// with a read port and removes it.
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
      provide: PRODUCT_REPOSITORY,
      useClass: DrizzleProductRepository,
    },
  ],
})
export class ProductModule {}
