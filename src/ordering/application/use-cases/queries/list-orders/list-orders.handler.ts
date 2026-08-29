import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OrderStatus } from '@/ordering/domain';
import type { Page } from '@/shared/application';
import {
  ORDER_READ_REPOSITORY,
  type OrderFilters,
  type OrderReadRepository,
} from '../../../ports/order.read-repository';
import type { OrderSummaryReadModel } from '../../../read-models/order.read-model';
import { ListOrdersQuery } from './list-orders.query';

/**
 * Two things happen here and nowhere else: the scope decides whose orders a
 * caller may list (a customer's own id overrides any filter they sent, staff
 * keep theirs), and the raw status string is parsed through `OrderStatus`, so
 * `?status=refunded` is a 422 rather than an empty page that reads as "no
 * refunded orders exist".
 */
@QueryHandler(ListOrdersQuery)
export class ListOrdersHandler implements IQueryHandler<
  ListOrdersQuery,
  Page<OrderSummaryReadModel>
> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY)
    private readonly orders: OrderReadRepository,
  ) {}

  async execute(query: ListOrdersQuery): Promise<Page<OrderSummaryReadModel>> {
    return this.orders.findMany(
      ListOrdersHandler.toFilters(query),
      query.pagination,
    );
  }

  private static toFilters(query: ListOrdersQuery): OrderFilters {
    const { status, customerId } = query.filters;

    return {
      status:
        status === undefined ? undefined : OrderStatus.create(status).value,
      customerId:
        query.scope.kind === 'customer' ? query.scope.customerId : customerId,
    };
  }
}
