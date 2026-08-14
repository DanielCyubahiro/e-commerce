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
