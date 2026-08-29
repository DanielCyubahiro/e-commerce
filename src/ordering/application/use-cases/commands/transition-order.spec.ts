import { IllegalOrderTransitionException } from '@/ordering/domain';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { seedPlaced } from '@test/fakes/seed-order';
import { catchRejection } from '@test/support/catch-error';
import { OrderConflictException } from '../../exceptions/order-conflict.exception';
import { OrderNotFoundException } from '../../exceptions/order-not-found.exception';
import { transitionOrder } from './transition-order';

const MISSING = '9c858901-8a57-4791-81fe-4c455b099bc9';

describe('transitionOrder', () => {
  let orders: InMemoryOrderWriteRepository;

  beforeEach(() => {
    orders = new InMemoryOrderWriteRepository();
  });

  it('loads, applies the move with the current time, and saves', async () => {
    const order = await seedPlaced(orders);
    const before = Date.now();

    await transitionOrder(orders, order.id.value, (o, now) => o.pay(now));

    const after = await orders.findById(order.id);
    expect(after?.status.value).toBe('paid');
    expect(after?.paidAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(after?.version).toBe(2);
  });

  it('answers not-found for an id nothing holds', async () => {
    const error = await catchRejection(
      () => transitionOrder(orders, MISSING, (o, now) => o.pay(now)),
      OrderNotFoundException,
    );

    expect(error.code).toBe('ORDER_NOT_FOUND');
  });

  it('lets the aggregate refuse an illegal move before anything is saved', async () => {
    const order = await seedPlaced(orders);

    await catchRejection(
      () => transitionOrder(orders, order.id.value, (o, now) => o.ship(now)),
      IllegalOrderTransitionException,
    );

    expect((await orders.findById(order.id))?.version).toBe(1);
  });

  it('reports a conflict when the save loses a race', async () => {
    const order = await seedPlaced(orders);
    jest.spyOn(orders, 'save').mockResolvedValueOnce('conflict');

    const error = await catchRejection(
      () => transitionOrder(orders, order.id.value, (o, now) => o.pay(now)),
      OrderConflictException,
    );

    expect(error.code).toBe('ORDER_CONFLICT');
  });
});
