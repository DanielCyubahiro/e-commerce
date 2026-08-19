import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Page } from '@/shared/application';
import { Money } from '@/shared/domain';
import {
  PRODUCT_READ_REPOSITORY,
  type ProductFilters,
  type ProductReadRepository,
} from '../../../ports/product.read-repository';
import type { ProductReadModel } from '../../../read-models/product.read-model';
import { ListProductsQuery } from './list-products.query';

/**
 * Converting decimal bounds to minor units happens here because presentation is
 * forbidden from importing the domain, and infrastructure should not know how a
 * decimal becomes an integer. The application layer is the only one entitled to
 * know both representations.
 */
@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<
  ListProductsQuery,
  Page<ProductReadModel>
> {
  constructor(
    @Inject(PRODUCT_READ_REPOSITORY)
    private readonly productRepository: ProductReadRepository,
  ) {}

  async execute(query: ListProductsQuery): Promise<Page<ProductReadModel>> {
    return this.productRepository.findMany(
      ListProductsHandler.toMinorUnits(query.filters),
      query.pagination,
    );
  }

  private static toMinorUnits(
    filters: ListProductsQuery['filters'],
  ): ProductFilters {
    const { currency } = filters;
    const convert = (amount: number | undefined): number | undefined =>
      amount === undefined
        ? undefined
        : Money.fromDecimal(amount, currency ?? 'EUR').minorUnits;

    return {
      minPriceMinorUnits: convert(filters.minPrice),
      maxPriceMinorUnits: convert(filters.maxPrice),
      currency,
    };
  }
}
