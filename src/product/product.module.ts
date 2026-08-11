import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductController } from './presentation/product.controller';
import { DrizzleProductRepository } from './infrastructure/adapters/drizzle-product.repository';
import { commandHandlers, queryHandlers } from './application';
import { PRODUCT_REPOSITORY } from './application/ports/product.repository';

@Module({
  imports: [CqrsModule],
  controllers: [ProductController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: DrizzleProductRepository,
    },
  ],
})
export class ProductModule {}
