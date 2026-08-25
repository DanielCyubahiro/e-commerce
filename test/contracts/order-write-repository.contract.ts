import {
  CustomerId,
  Order,
  OrderId,
  type PlaceOrderInput,
} from '@/ordering/domain';
import type { OrderWriteRepository } from '@/ordering/application';
import type { Transaction, UnitOfWork } from '@/shared/application';

export interface OrderWriteHarness {
  repository: OrderWriteRepository;
  uow: UnitOfWork;
  reset(): Promise<void>;
  close(): Promise<void>;
}

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_CUSTOMER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const KEY = '9c858901-8a57-4791-81fe-4c455b099bc9';
const NOW = new Date('2026-08-25T10:00:00.000Z');

class RollBack extends Error {
  constructor() {
    super('roll back');
    this.name = 'RollBack';
  }
}

export const anOrder = (customerId = CUSTOMER): Order =>
  Order.place({
    customerId,
    lines: [
      {
        productId: '00000000-0000-4000-8000-000000000001',
        sku: 'ESP-001',
        name: 'Espresso Machine',
        unitPriceMinorUnits: 24999,
        currency: 'EUR',
        quantity: 2,
      },
      {
        productId: '00000000-0000-4000-8000-000000000002',
        sku: 'KET-1',
        name: 'Kettle',
        unitPriceMinorUnits: 1000,
        currency: 'EUR',
        quantity: 1,
      },
    ],
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Analytical Way',
      line2: 'Flat 2',
      city: 'London',
      postalCode: 'N1 1AA',
      country: 'GB',
    } satisfies PlaceOrderInput['shippingAddress'],
  });

export function orderWriteRepositoryContract(
  name: string,
  makeHarness: () => Promise<OrderWriteHarness>,
): void {
  describe(`OrderWriteRepository contract (${name})`, () => {
    let harness: OrderWriteHarness;

    const place = (order: Order, idempotencyKey: string | null = null) =>
      harness.uow.run((tx: Transaction) =>
        harness.repository.place({ order, idempotencyKey }, tx),
      );

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('places an order and reconstitutes an equal one', async () => {
      const order = anOrder();

      await expect(place(order)).resolves.toBe('placed');
      const found = await harness.repository.findById(order.id);

      expect(found?.equals(order)).toBe(true);
      expect(found?.status.value).toBe('placed');
      expect(found?.version).toBe(1);
      expect(found?.customerId.value).toBe(CUSTOMER);
      expect(found?.total.minorUnits).toBe(50998);
      expect(found?.subtotal.equals(order.subtotal)).toBe(true);
      expect(found?.shippingAddress.equals(order.shippingAddress)).toBe(true);
      expect(found?.lines.map((line) => line.sku)).toEqual([
        'ESP-001',
        'KET-1',
      ]);
      expect(found?.lines.every((line, i) => line.equals(order.lines[i]))).toBe(
        true,
      );
      expect(found?.paidAt).toBeNull();
    });

    it('answers null for an id nothing holds', async () => {
      await expect(
        harness.repository.findById(OrderId.create()),
      ).resolves.toBeNull();
    });

    it('saves a transition on the current version and increments it', async () => {
      const order = anOrder();
      await place(order);
      const loaded = await harness.repository.findById(order.id);
      loaded?.pay(NOW);

      await expect(harness.repository.save(loaded as Order)).resolves.toBe(
        'saved',
      );

      const after = await harness.repository.findById(order.id);
      expect(after?.status.value).toBe('paid');
      expect(after?.paidAt).toEqual(NOW);
      expect(after?.version).toBe(2);
    });

    it('reports a conflict, and changes nothing, when the version is stale', async () => {
      const order = anOrder();
      await place(order);
      const first = await harness.repository.findById(order.id);
      const second = await harness.repository.findById(order.id);
      first?.pay(NOW);
      second?.cancel(NOW);
      await harness.repository.save(first as Order);

      await expect(harness.repository.save(second as Order)).resolves.toBe(
        'conflict',
      );

      const after = await harness.repository.findById(order.id);
      expect(after?.status.value).toBe('paid');
      expect(after?.cancelledAt).toBeNull();
      expect(after?.version).toBe(2);
    });

    it('reports a conflict for an order that was never placed', async () => {
      const order = anOrder();
      order.pay(NOW);

      await expect(harness.repository.save(order)).resolves.toBe('conflict');
    });

    it('saves inside a transaction when given one', async () => {
      const order = anOrder();
      await place(order);
      const loaded = (await harness.repository.findById(order.id)) as Order;
      loaded.pay(NOW);

      await expect(
        harness.uow.run(async (tx) => {
          await harness.repository.save(loaded, tx);
          throw new RollBack();
        }),
      ).rejects.toBeInstanceOf(RollBack);

      expect((await harness.repository.findById(order.id))?.status.value).toBe(
        'placed',
      );
    });

    it('reports a duplicate key for the same customer and key, storing nothing', async () => {
      const first = anOrder();
      const second = anOrder();
      await place(first, KEY);

      await expect(place(second, KEY)).resolves.toBe('duplicate-key');

      await expect(harness.repository.findById(second.id)).resolves.toBeNull();
      expect((await harness.repository.findById(first.id))?.equals(first)).toBe(
        true,
      );
    });

    it('lets different customers reuse a key', async () => {
      await expect(place(anOrder(CUSTOMER), KEY)).resolves.toBe('placed');
      await expect(place(anOrder(OTHER_CUSTOMER), KEY)).resolves.toBe('placed');
    });

    it('never treats two keyless orders as duplicates', async () => {
      await expect(place(anOrder())).resolves.toBe('placed');
      await expect(place(anOrder())).resolves.toBe('placed');
    });

    it('finds an order id by customer and key, and misses otherwise', async () => {
      const order = anOrder();
      await place(order, KEY);

      const hit = await harness.repository.findIdByIdempotencyKey(
        CustomerId.create(CUSTOMER),
        KEY,
      );
      const otherCustomer = await harness.repository.findIdByIdempotencyKey(
        CustomerId.create(OTHER_CUSTOMER),
        KEY,
      );
      const otherKey = await harness.repository.findIdByIdempotencyKey(
        CustomerId.create(CUSTOMER),
        '00000000-0000-4000-8000-00000000abcd',
      );

      expect(hit?.equals(order.id)).toBe(true);
      expect(otherCustomer).toBeNull();
      expect(otherKey).toBeNull();
    });

    it('a placement the caller rolls back leaves nothing behind', async () => {
      const order = anOrder();

      await expect(
        harness.uow.run(async (tx) => {
          await harness.repository.place({ order, idempotencyKey: KEY }, tx);
          throw new RollBack();
        }),
      ).rejects.toBeInstanceOf(RollBack);

      await expect(harness.repository.findById(order.id)).resolves.toBeNull();
      await expect(
        harness.repository.findIdByIdempotencyKey(
          CustomerId.create(CUSTOMER),
          KEY,
        ),
      ).resolves.toBeNull();
    });
  });
}
