import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductController } from './presentation/product.controller';

@Module({
  imports: [CqrsModule],
  controllers: [ProductController],
  providers: [],
})
export class ProductModule {}
