import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  ORDER_WRITE_REPOSITORY,
  type OrderWriteRepository,
} from '../../../ports/order.write-repository';
import { transitionOrder } from '../transition-order';
import { DeliverOrderCommand } from './deliver-order.command';

/** Records delivery, the terminal success state. */
@CommandHandler(DeliverOrderCommand)
export class DeliverOrderHandler implements ICommandHandler<
  DeliverOrderCommand,
  void
> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly orders: OrderWriteRepository,
  ) {}

  execute(command: DeliverOrderCommand): Promise<void> {
    return transitionOrder(this.orders, command.orderId, (order, now) =>
      order.deliver(now),
    );
  }
}
