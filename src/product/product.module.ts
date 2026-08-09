import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductController } from './presentation/product.controller';
import { DrizzleProductRepository } from './infrastructure/adapters/drizzle-product.repository';
import { commandHandlers } from './application';

@Module({
  imports: [CqrsModule],
  controllers: [ProductController],
  providers: [
    ...commandHandlers,
    {
      provide: 'PRODUCT_REPOSITORY',
      useClass: DrizzleProductRepository,
    },
  ],
})
export class ProductModule {}
