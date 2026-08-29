import {
  InvalidOrderLinesException,
  InvalidQuantityException,
} from '@/ordering/domain';
import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { InMemoryStockAllocator } from '@test/fakes/in-memory-stock-allocator';
import { seedProduct, type SeededProduct } from '@test/fakes/seed-product';
import { catchRejection } from '@test/support/catch-error';
import { StockUnavailableException } from '../../../exceptions/stock-unavailable.exception';
import { PlaceOrderCommand } from './place-order.command';
import { PlaceOrderHandler } from './place-order.handler';

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const KEY = '9c858901-8a57-4791-81fe-4c455b099bc9';
const MISSING_PRODUCT = '16fd2706-8baf-433b-82eb-8c7fada847da';
const ADDRESS = {
  recipientName: 'Ada Lovelace',
  line1: '1 Analytical Way',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'GB',
};

describe('PlaceOrderHandler', () => {
  let products: InMemoryProductWriteRepository;
  let orders: InMemoryOrderWriteRepository;
  let handler: PlaceOrderHandler;
  let espresso: SeededProduct;
  let kettle: SeededProduct;
  let mug: SeededProduct;

  const command = (
    lines: { productId: string; quantity: number }[] = [
      { productId: espresso.id, quantity: 2 },
      { productId: kettle.id, quantity: 1 },
    ],
    idempotencyKey: string | null = null,
  ): PlaceOrderCommand =>
    new PlaceOrderCommand(CUSTOMER, lines, ADDRESS, idempotencyKey);

  beforeEach(async () => {
    products = new InMemoryProductWriteRepository();
    orders = new InMemoryOrderWriteRepository();
    handler = new PlaceOrderHandler(
      orders,
      new InMemoryStockAllocator(products),
      new FakeUnitOfWork([products, orders]),
    );
    espresso = await seedProduct(products, {
      sku: 'ESP-001',
      name: 'Espresso Machine',
      price: 249.99,
      stock: 12,
    });
    kettle = await seedProduct(products, {
      sku: 'KET-1',
      name: 'Kettle',
      price: 10,
      stock: 3,
    });
    mug = await seedProduct(products, {
      sku: 'MUG-1',
      name: 'Mug',
      price: 5,
      stock: 4,
      currency: 'USD',
    });
  });

  it('returns the id of the order it stored, priced from the allocation snapshot', async () => {
    const id = await handler.execute(command());

    const stored = orders.stored()[0];
    expect(stored?.order.id.value).toBe(id);
    expect(stored?.order.customerId.value).toBe(CUSTOMER);
    expect(stored?.order.total.minorUnits).toBe(49998 + 1000);
    expect(stored?.order.lines.map((line) => line.name).sort()).toEqual([
      'Espresso Machine',
      'Kettle',
    ]);
    expect(stored?.idempotencyKey).toBeNull();
  });

  it('decrements stock for every line', async () => {
    await handler.execute(command());

    expect(espresso.stock()).toBe(10);
    expect(kettle.stock()).toBe(2);
  });

  it('rejects a shortfall with every detail, and leaves all stock as it was', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          command([
            { productId: espresso.id, quantity: 2 },
            { productId: kettle.id, quantity: 5 },
          ]),
        ),
      StockUnavailableException,
    );

    expect(error.code).toBe('ORDER_STOCK_UNAVAILABLE');
    expect(error.details).toEqual([
      { productId: kettle.id, reason: 'insufficient', available: 3 },
    ]);
    // The espresso decrement happened inside the transaction and was undone
    // with it; the fake unit of work restored the product store.
    expect(espresso.stock()).toBe(12);
    expect(orders.stored()).toHaveLength(0);
  });

  it('treats an unknown product as a shortfall too', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(command([{ productId: MISSING_PRODUCT, quantity: 1 }])),
      StockUnavailableException,
    );

    expect(error.details).toEqual([
      { productId: MISSING_PRODUCT, reason: 'unknown', available: null },
    ]);
  });

  it('rejects a bad quantity before the allocator is touched', async () => {
    const error = await catchRejection(
      () => handler.execute(command([{ productId: espresso.id, quantity: 0 }])),
      InvalidQuantityException,
    );

    expect(error.code).toBe('ORDER_QUANTITY_INVALID');
    expect(espresso.stock()).toBe(12);
  });

  it('rolls the allocation back when the lines mix currencies', async () => {
    // The currency rule needs the allocation's snapshot (each product's own
    // price), so it is the one collection rule that cannot run before
    // allocating; both lines allocate, then Order.place refuses the mix and
    // the transaction has to give the stock back.
    const error = await catchRejection(
      () =>
        handler.execute(
          command([
            { productId: espresso.id, quantity: 1 },
            { productId: mug.id, quantity: 1 },
          ]),
        ),
      InvalidOrderLinesException,
    );

    expect(error.code).toBe('ORDER_LINES_INVALID');
    expect(espresso.stock()).toBe(12);
    expect(mug.stock()).toBe(4);
    expect(orders.stored()).toHaveLength(0);
  });

  it('rejects a repeated product before the allocator is touched', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          command([
            { productId: espresso.id, quantity: 1 },
            { productId: espresso.id, quantity: 1 },
          ]),
        ),
      InvalidOrderLinesException,
    );

    expect(error.code).toBe('ORDER_LINES_INVALID');
    expect(espresso.stock()).toBe(12);
    expect(orders.stored()).toHaveLength(0);
  });

  it('rejects more than 100 lines before the allocator is touched', async () => {
    const lines = Array.from({ length: 101 }, (_, i) => ({
      productId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      quantity: 1,
    }));

    const error = await catchRejection(
      () => handler.execute(command(lines)),
      InvalidOrderLinesException,
    );

    expect(error.code).toBe('ORDER_LINES_INVALID');
    // None of the 101 synthetic ids is espresso's, so an unchanged stock
    // combined with nothing stored proves the allocator was never called at
    // all, not merely called and rolled back.
    expect(espresso.stock()).toBe(12);
    expect(orders.stored()).toHaveLength(0);
  });

  it('replays a key by returning the first order without allocating again', async () => {
    const first = await handler.execute(command(undefined, KEY));

    const second = await handler.execute(command(undefined, KEY));

    expect(second).toBe(first);
    expect(orders.stored()).toHaveLength(1);
    expect(espresso.stock()).toBe(10);
  });

  it('resolves the race where another request commits the key between check and insert', async () => {
    const first = await handler.execute(command(undefined, KEY));
    // Simulates the concurrent-replay window: the pre-check misses, the
    // insert then meets the key. A spy rather than a fake seam because the
    // window is a timing, not a state the store can hold.
    jest.spyOn(orders, 'findIdByIdempotencyKey').mockResolvedValueOnce(null);

    const second = await handler.execute(command(undefined, KEY));

    expect(second).toBe(first);
    expect(orders.stored()).toHaveLength(1);
    expect(espresso.stock()).toBe(10);
  });

  it('re-throws the race-lost error when the retry lookup also comes up empty', async () => {
    await handler.execute(command(undefined, KEY));
    // Forces the pre-check and the post-loss retry to both miss, a state the
    // fake cannot reach on its own (place() only answers 'duplicate-key' when
    // a row does hold the key). Exercises the handler's fallback: with no
    // winner to resolve to, it re-throws rather than inventing an id.
    jest
      .spyOn(orders, 'findIdByIdempotencyKey')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const error = await catchRejection(
      () => handler.execute(command(undefined, KEY)),
      Error,
    );

    expect(error.name).toBe('IdempotencyKeyRaceLost');
  });

  it('places two orders for two keyless identical requests', async () => {
    const first = await handler.execute(command());
    const second = await handler.execute(command());

    expect(second).not.toBe(first);
    expect(orders.stored()).toHaveLength(2);
    expect(espresso.stock()).toBe(8);
  });
});
