import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OrderId } from '@/ordering/domain';
import { OrderNotFoundException } from '../../../exceptions/order-not-found.exception';
import { customerFilterOf } from '../../../order-scope';
import {
  ORDER_READ_REPOSITORY,
  type OrderReadRepository,
} from '../../../ports/order.read-repository';
import type { OrderDetailReadModel } from '../../../read-models/order.read-model';
import { GetOrderQuery } from './get-order.query';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<
  GetOrderQuery,
  OrderDetailReadModel
> {
  constructor(
    @Inject(ORDER_READ_REPOSITORY)
    private readonly orders: OrderReadRepository,
  ) {}

  /** @throws OrderNotFoundException when nothing holds the id, or the scope cannot see it */
  async execute(query: GetOrderQuery): Promise<OrderDetailReadModel> {
    const order = await this.orders.findById(
      OrderId.create(query.orderId),
      customerFilterOf(query.scope),
    );

    if (!order) {
      throw new OrderNotFoundException(query.orderId);
    }

    return order;
  }
}
