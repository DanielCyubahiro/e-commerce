import { IllegalOrderTransitionException, type Order } from '@/ordering/domain';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { seedPlaced } from '@test/fakes/seed-order';
import { PayOrderCommand } from '../pay-order/pay-order.command';
import { PayOrderHandler } from '../pay-order/pay-order.handler';
import { ShipOrderCommand } from './ship-order.command';
import { ShipOrderHandler } from './ship-order.handler';

describe('ShipOrderHandler', () => {
  let orders: InMemoryOrderWriteRepository;
  let handler: ShipOrderHandler;
  let order: Order;

  beforeEach(async () => {
    orders = new InMemoryOrderWriteRepository();
    handler = new ShipOrderHandler(orders);
    order = await seedPlaced(orders);
    await new PayOrderHandler(orders).execute(
      new PayOrderCommand(order.id.value),
    );
  });

  it('moves a paid order to shipped', async () => {
    await handler.execute(new ShipOrderCommand(order.id.value));

    const after = await orders.findById(order.id);
    expect(after?.status.value).toBe('shipped');
    expect(after?.shippedAt).toBeInstanceOf(Date);
  });

  it('refuses to ship a placed order', async () => {
    const unpaid = await seedPlaced(
      orders,
      '16fd2706-8baf-433b-82eb-8c7fada847da',
    );

    const error = await catchRejection(
      () => handler.execute(new ShipOrderCommand(unpaid.id.value)),
      IllegalOrderTransitionException,
    );

    expect(error.code).toBe('ORDER_TRANSITION_ILLEGAL');
  });
});
