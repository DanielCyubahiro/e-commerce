import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { STOCK_ALLOCATOR, type StockAllocator } from '@/catalogue/application';
import { CustomerId, Order, OrderLineRequest } from '@/ordering/domain';
import { UNIT_OF_WORK, type UnitOfWork } from '@/shared/application';
import { StockUnavailableException } from '../../../exceptions/stock-unavailable.exception';
import {
  ORDER_WRITE_REPOSITORY,
  type OrderWriteRepository,
} from '../../../ports/order.write-repository';
import { PlaceOrderCommand } from './place-order.command';

/**
 * Thrown inside the unit of work when the insert meets an idempotency key
 * that the pre-check did not see (a concurrent replay), so the allocation
 * made moments earlier rolls back; caught below and resolved to the order
 * that won.
 */
class IdempotencyKeyRaceLost extends Error {
  constructor() {
    super('Another request placed this order first.');
    this.name = 'IdempotencyKeyRaceLost';
  }
}

/**
 * Validates the quantities, allocates stock, builds the aggregate from the
 * allocation's snapshot, and inserts it, all inside one transaction, so a
 * shortfall or a domain rule failing after allocation gives the stock back.
 *
 * The idempotency pre-check runs outside the transaction because a replay is
 * the common case and should not cost an allocation; the unique index is the
 * arbiter for the race the pre-check cannot see.
 */
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<
  PlaceOrderCommand,
  string
> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly orders: OrderWriteRepository,
    @Inject(STOCK_ALLOCATOR) private readonly allocator: StockAllocator,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** @returns the placed order's id, or the earlier order's id on a replayed key */
  async execute(command: PlaceOrderCommand): Promise<string> {
    // Before any port: a negative quantity would turn the allocator's
    // `stock - qty` into an increment.
    const requests = command.lines.map((line) => OrderLineRequest.create(line));
    // Count and distinctness cost nothing; checking them here, before any
    // port runs, means an oversized or repeated request is never paid for
    // with an allocation's row locks.
    Order.checkLineRequests(requests);
    const customerId = CustomerId.create(command.customerId);
    const { idempotencyKey } = command;

    if (idempotencyKey !== null) {
      const existing = await this.orders.findIdByIdempotencyKey(
        customerId,
        idempotencyKey,
      );
      if (existing) {
        return existing.value;
      }
    }

    try {
      return await this.uow.run(async (tx) => {
        const allocation = await this.allocator.allocate(
          requests.map((request) => ({
            productId: request.productRef.value,
            quantity: request.quantity.value,
          })),
          tx,
        );

        if (allocation.kind === 'rejected') {
          throw new StockUnavailableException(allocation.shortfalls);
        }

        const order = Order.place({
          customerId: command.customerId,
          lines: allocation.lines,
          shippingAddress: command.shippingAddress,
        });

        const outcome = await this.orders.place({ order, idempotencyKey }, tx);

        if (outcome === 'duplicate-key') {
          throw new IdempotencyKeyRaceLost();
        }

        return order.id.value;
      });
    } catch (error) {
      if (error instanceof IdempotencyKeyRaceLost && idempotencyKey !== null) {
        const winner = await this.orders.findIdByIdempotencyKey(
          customerId,
          idempotencyKey,
        );
        if (winner) {
          return winner.value;
        }
      }
      throw error;
    }
  }
}
