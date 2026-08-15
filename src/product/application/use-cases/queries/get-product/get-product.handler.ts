import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProductId } from '@/product/domain';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';
import {
  PRODUCT_READ_REPOSITORY,
  type ProductReadRepository,
} from '../../../ports/product.read-repository';
import type { ProductReadModel } from '../../../read-models/product.read-model';
import { GetProductQuery } from './get-product.query';

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<
  GetProductQuery,
  ProductReadModel
> {
  constructor(
    @Inject(PRODUCT_READ_REPOSITORY)
    private readonly productRepository: ProductReadRepository,
  ) {}

  /** @throws ProductNotFoundException when no product holds that id. */
  async execute(query: GetProductQuery): Promise<ProductReadModel> {
    const product = await this.productRepository.findById(
      ProductId.create(query.productId),
    );

    if (!product) {
      throw new ProductNotFoundException(query.productId);
    }

    return product;
  }
}
