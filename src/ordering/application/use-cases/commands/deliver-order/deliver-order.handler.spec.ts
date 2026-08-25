import { IllegalOrderTransitionException, type Order } from '@/ordering/domain';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { seedPlaced } from '@test/fakes/seed-order';
import { PayOrderCommand } from '../pay-order/pay-order.command';
import { PayOrderHandler } from '../pay-order/pay-order.handler';
import { ShipOrderCommand } from '../ship-order/ship-order.command';
import { ShipOrderHandler } from '../ship-order/ship-order.handler';
import { DeliverOrderCommand } from './deliver-order.command';
import { DeliverOrderHandler } from './deliver-order.handler';

describe('DeliverOrderHandler', () => {
  let orders: InMemoryOrderWriteRepository;
  let handler: DeliverOrderHandler;
  let order: Order;

  beforeEach(async () => {
    orders = new InMemoryOrderWriteRepository();
    handler = new DeliverOrderHandler(orders);
    order = await seedPlaced(orders);
    await new PayOrderHandler(orders).execute(
      new PayOrderCommand(order.id.value),
    );
    await new ShipOrderHandler(orders).execute(
      new ShipOrderCommand(order.id.value),
    );
  });

  it('moves a shipped order to delivered', async () => {
    await handler.execute(new DeliverOrderCommand(order.id.value));

    const after = await orders.findById(order.id);
    expect(after?.status.value).toBe('delivered');
    expect(after?.deliveredAt).toBeInstanceOf(Date);
  });

  it('refuses to deliver a paid but unshipped order', async () => {
    const unshipped = await seedPlaced(
      orders,
      '16fd2706-8baf-433b-82eb-8c7fada847da',
    );
    await new PayOrderHandler(orders).execute(
      new PayOrderCommand(unshipped.id.value),
    );

    const error = await catchRejection(
      () => handler.execute(new DeliverOrderCommand(unshipped.id.value)),
      IllegalOrderTransitionException,
    );

    expect(error.code).toBe('ORDER_TRANSITION_ILLEGAL');
  });
});
