import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { STOCK_ALLOCATOR, type StockAllocator } from '@/catalogue/application';
import { CustomerId, type Order, OrderId } from '@/ordering/domain';
import { UNIT_OF_WORK, type UnitOfWork } from '@/shared/application';
import { OrderConflictException } from '../../../exceptions/order-conflict.exception';
import { OrderNotFoundException } from '../../../exceptions/order-not-found.exception';
import type { OrderScope } from '../../../order-scope';
import {
  ORDER_WRITE_REPOSITORY,
  type OrderWriteRepository,
} from '../../../ports/order.write-repository';
import { CancelOrderCommand } from './cancel-order.command';

/**
 * Loads, asks the aggregate to cancel (which refuses once shipped), then saves
 * and releases the stock in one transaction: a cancellation that gave stock
 * back without recording itself, or the reverse, must not be possible.
 *
 * Ownership is checked on the loaded aggregate: under customer scope another
 * customer's order answers the same not-found as a missing one.
 */
@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<
  CancelOrderCommand,
  void
> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly orders: OrderWriteRepository,
    @Inject(STOCK_ALLOCATOR) private readonly allocator: StockAllocator,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(command: CancelOrderCommand): Promise<void> {
    const order = await this.orders.findById(OrderId.create(command.orderId));

    if (!order || !CancelOrderHandler.visibleTo(order, command.scope)) {
      throw new OrderNotFoundException(command.orderId);
    }

    order.cancel(new Date());

    await this.uow.run(async (tx) => {
      const saved = await this.orders.save(order, tx);

      if (saved === 'conflict') {
        throw new OrderConflictException(command.orderId);
      }

      await this.allocator.release(
        order.lines.map((line) => ({
          productId: line.productRef.value,
          quantity: line.quantity.value,
        })),
        tx,
      );
    });
  }

  private static visibleTo(order: Order, scope: OrderScope): boolean {
    return (
      scope.kind === 'staff' ||
      order.isOwnedBy(CustomerId.create(scope.customerId))
    );
  }
}
