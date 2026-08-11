import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { ListProductsQuery } from './list-products.query';
import { Inject } from '@nestjs/common';
import type { ProductRepository } from '../../../ports/product.repository';
import type { Product } from '../../../../domain/entities/product.entity';

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery> {
  constructor(
    @Inject('PRODUCT_REPOSITORY')
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(query: ListProductsQuery): Promise<Product[]> {
    return this.productRepository.findAll({
      isActive: query.isActive,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    });
  }
}
