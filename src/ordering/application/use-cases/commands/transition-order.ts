import { type Order, OrderId } from '@/ordering/domain';
import { OrderConflictException } from '../../exceptions/order-conflict.exception';
import { OrderNotFoundException } from '../../exceptions/order-not-found.exception';
import type { OrderWriteRepository } from '../../ports/order.write-repository';

/**
 * The load, mutate, save skeleton pay, ship, and deliver share, written once.
 * No unit of work: each of those is one guarded statement, so the version
 * predicate on `save` is the whole concurrency story.
 *
 * @throws OrderNotFoundException when nothing holds the id
 * @throws OrderConflictException when the row moved since it was loaded
 * @throws whatever `mutate` throws, before anything is saved
 */
export async function transitionOrder(
  orders: OrderWriteRepository,
  orderId: string,
  mutate: (order: Order, now: Date) => void,
): Promise<void> {
  const order = await orders.findById(OrderId.create(orderId));

  if (!order) {
    throw new OrderNotFoundException(orderId);
  }

  mutate(order, new Date());

  const outcome = await orders.save(order);

  if (outcome === 'conflict') {
    throw new OrderConflictException(orderId);
  }
}
