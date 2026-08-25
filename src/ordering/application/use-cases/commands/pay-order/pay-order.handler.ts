import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  ORDER_WRITE_REPOSITORY,
  type OrderWriteRepository,
} from '../../../ports/order.write-repository';
import { transitionOrder } from '../transition-order';
import { PayOrderCommand } from './pay-order.command';

/** Records that payment was received; there is no provider behind it. */
@CommandHandler(PayOrderCommand)
export class PayOrderHandler implements ICommandHandler<PayOrderCommand, void> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly orders: OrderWriteRepository,
  ) {}

  execute(command: PayOrderCommand): Promise<void> {
    return transitionOrder(this.orders, command.orderId, (order, now) =>
      order.pay(now),
    );
  }
}
