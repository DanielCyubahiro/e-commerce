import { IllegalOrderTransitionException, type Order } from '@/ordering/domain';
import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { InMemoryStockAllocator } from '@test/fakes/in-memory-stock-allocator';
import { catchRejection } from '@test/support/catch-error';
import { Product } from '@test/support/product-fixture';
import { OrderConflictException } from '../../../exceptions/order-conflict.exception';
import { OrderNotFoundException } from '../../../exceptions/order-not-found.exception';
import { PlaceOrderCommand } from '../place-order/place-order.command';
import { PlaceOrderHandler } from '../place-order/place-order.handler';
import { CancelOrderCommand } from './cancel-order.command';
import { CancelOrderHandler } from './cancel-order.handler';

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_CUSTOMER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const MISSING_ORDER = '9c858901-8a57-4791-81fe-4c455b099bc9';
const NOW = new Date('2026-08-25T10:00:00.000Z');

describe('CancelOrderHandler', () => {
  let products: InMemoryProductWriteRepository;
  let orders: InMemoryOrderWriteRepository;
  let handler: CancelOrderHandler;
  let espresso: Product;
  let orderId: string;

  const stockOf = (): number =>
    products.snapshot().find((p) => p.id.equals(espresso.id))?.stock ?? -1;

  const statusOf = async (): Promise<string | undefined> =>
    (await orders.findById(orders.stored()[0]?.order.id as Order['id']))?.status
      .value;

  beforeEach(async () => {
    products = new InMemoryProductWriteRepository();
    orders = new InMemoryOrderWriteRepository();
    const allocator = new InMemoryStockAllocator(products);
    const uow = new FakeUnitOfWork([products, orders]);
    handler = new CancelOrderHandler(orders, allocator, uow);
    espresso = Product.create({
      name: 'Espresso Machine',
      description: 'Makes espresso.',
      price: 249.99,
      currency: 'EUR',
      sku: 'ESP-001',
      stock: 12,
    });
    await products.add(espresso);
    orderId = await new PlaceOrderHandler(orders, allocator, uow).execute(
      new PlaceOrderCommand(
        CUSTOMER,
        [{ productId: espresso.id.value, quantity: 2 }],
        {
          recipientName: 'Ada Lovelace',
          line1: '1 Analytical Way',
          city: 'London',
          postalCode: 'N1 1AA',
          country: 'GB',
        },
        null,
      ),
    );
  });

  const advanceTo = async (target: 'paid' | 'shipped'): Promise<void> => {
    const loaded = (await orders.findById(
      orders.stored()[0]?.order.id as Order['id'],
    )) as Order;
    loaded.pay(NOW);
    await orders.save(loaded);
    if (target === 'shipped') {
      const paid = (await orders.findById(loaded.id)) as Order;
      paid.ship(NOW);
      await orders.save(paid);
    }
  };

  it('lets the owner cancel a placed order and gives the stock back', async () => {
    expect(stockOf()).toBe(10);

    await handler.execute(
      new CancelOrderCommand(orderId, {
        kind: 'customer',
        customerId: CUSTOMER,
      }),
    );

    expect(await statusOf()).toBe('cancelled');
    expect(stockOf()).toBe(12);
  });

  it('lets the owner cancel a paid order too', async () => {
    await advanceTo('paid');

    await handler.execute(
      new CancelOrderCommand(orderId, {
        kind: 'customer',
        customerId: CUSTOMER,
      }),
    );

    expect(await statusOf()).toBe('cancelled');
  });

  it('answers not-found for another customer, changing nothing', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new CancelOrderCommand(orderId, {
            kind: 'customer',
            customerId: OTHER_CUSTOMER,
          }),
        ),
      OrderNotFoundException,
    );

    expect(error.code).toBe('ORDER_NOT_FOUND');
    expect(await statusOf()).toBe('placed');
    expect(stockOf()).toBe(10);
  });

  it('lets staff cancel any order', async () => {
    await handler.execute(new CancelOrderCommand(orderId, { kind: 'staff' }));

    expect(await statusOf()).toBe('cancelled');
    expect(stockOf()).toBe(12);
  });

  it('answers not-found for an id nothing holds', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new CancelOrderCommand(MISSING_ORDER, { kind: 'staff' }),
        ),
      OrderNotFoundException,
    );

    expect(error.code).toBe('ORDER_NOT_FOUND');
  });

  it('refuses once the order has shipped, releasing nothing', async () => {
    await advanceTo('shipped');

    const error = await catchRejection(
      () => handler.execute(new CancelOrderCommand(orderId, { kind: 'staff' })),
      IllegalOrderTransitionException,
    );

    expect(error.code).toBe('ORDER_TRANSITION_ILLEGAL');
    expect(await statusOf()).toBe('shipped');
    expect(stockOf()).toBe(10);
  });

  it('reports a conflict and releases nothing when the save loses a race', async () => {
    // A stale version between load and save is a timing, not a state the
    // fake can hold, so the outcome is forced on the one call that would see it.
    jest.spyOn(orders, 'save').mockResolvedValueOnce('conflict');

    const error = await catchRejection(
      () => handler.execute(new CancelOrderCommand(orderId, { kind: 'staff' })),
      OrderConflictException,
    );

    expect(error.code).toBe('ORDER_CONFLICT');
    expect(stockOf()).toBe(10);
    expect(await statusOf()).toBe('placed');
  });
});
