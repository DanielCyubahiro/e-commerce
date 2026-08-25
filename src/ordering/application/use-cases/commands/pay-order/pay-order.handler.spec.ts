import { IllegalOrderTransitionException, type Order } from '@/ordering/domain';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { seedPlaced } from '@test/fakes/seed-order';
import { PayOrderCommand } from './pay-order.command';
import { PayOrderHandler } from './pay-order.handler';

describe('PayOrderHandler', () => {
  let orders: InMemoryOrderWriteRepository;
  let handler: PayOrderHandler;
  let order: Order;

  beforeEach(async () => {
    orders = new InMemoryOrderWriteRepository();
    handler = new PayOrderHandler(orders);
    order = await seedPlaced(orders);
  });

  it('moves a placed order to paid', async () => {
    await handler.execute(new PayOrderCommand(order.id.value));

    const after = await orders.findById(order.id);
    expect(after?.status.value).toBe('paid');
    expect(after?.paidAt).toBeInstanceOf(Date);
  });

  it('refuses to pay twice', async () => {
    await handler.execute(new PayOrderCommand(order.id.value));

    const error = await catchRejection(
      () => handler.execute(new PayOrderCommand(order.id.value)),
      IllegalOrderTransitionException,
    );

    expect(error.code).toBe('ORDER_TRANSITION_ILLEGAL');
  });
});
