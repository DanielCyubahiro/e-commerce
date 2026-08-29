import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  ORDER_WRITE_REPOSITORY,
  type OrderWriteRepository,
} from '../../../ports/order.write-repository';
import { transitionOrder } from '../transition-order';
import { ShipOrderCommand } from './ship-order.command';

/** Records that the parcel left; there is no carrier behind it. */
@CommandHandler(ShipOrderCommand)
export class ShipOrderHandler implements ICommandHandler<
  ShipOrderCommand,
  void
> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly orders: OrderWriteRepository,
  ) {}

  execute(command: ShipOrderCommand): Promise<void> {
    return transitionOrder(this.orders, command.orderId, (order, now) =>
      order.ship(now),
    );
  }
}
