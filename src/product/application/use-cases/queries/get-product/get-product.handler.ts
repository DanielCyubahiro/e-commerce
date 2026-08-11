import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetProductQuery } from './get-product.query';
import { Inject } from '@nestjs/common';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../../ports/product.repository';
import type { Product } from '../../../../domain/entities/product.entity';
import { ProductId } from '../../../../domain/value-objects/product-id.vo';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(query: GetProductQuery): Promise<Product> {
    const product = await this.productRepository.findById(
      ProductId.create(query.productId),
    );

    if (!product) {
      throw new ProductNotFoundException(query.productId);
    }

    return product;
  }
}
