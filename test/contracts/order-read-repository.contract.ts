import type {
  OrderReadRepository,
  OrderWriteRepository,
} from '@/ordering/application';
import { Order, OrderId } from '@/ordering/domain';
import type { UnitOfWork } from '@/shared/application';
import { anOrder } from './order-write-repository.contract';

export interface OrderReadHarness {
  read: OrderReadRepository;
  /** Seeding goes through the write port, so the contract never assumes how rows are inserted. */
  write: OrderWriteRepository;
  uow: UnitOfWork;
  reset(): Promise<void>;
  close(): Promise<void>;
}

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_CUSTOMER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const NOW = new Date('2026-08-25T10:00:00.000Z');

export function orderReadRepositoryContract(
  name: string,
  makeHarness: () => Promise<OrderReadHarness>,
): void {
  describe(`OrderReadRepository contract (${name})`, () => {
    let harness: OrderReadHarness;

    const store = async (customerId = CUSTOMER): Promise<Order> => {
      const order = anOrder(customerId);
      await harness.uow.run((tx) =>
        harness.write.place({ order, idempotencyKey: null }, tx),
      );
      return order;
    };

    const pay = async (order: Order): Promise<void> => {
      const loaded = (await harness.write.findById(order.id)) as Order;
      loaded.pay(NOW);
      await harness.write.save(loaded);
    };

    const all = () => harness.read.findMany({}, { limit: 100, offset: 0 });

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    describe('findById', () => {
      it('projects the whole order, lines in product id order', async () => {
        const order = await store();

        const found = await harness.read.findById(order.id);

        expect(found).toMatchObject({
          id: order.id.value,
          customerId: CUSTOMER,
          status: 'placed',
          currency: 'EUR',
          subtotalMinorUnits: 50998,
          shippingFeeMinorUnits: 0,
          taxMinorUnits: 0,
          totalMinorUnits: 50998,
          lineCount: 2,
          paidAt: null,
          shippedAt: null,
          deliveredAt: null,
          cancelledAt: null,
          shippingAddress: {
            recipientName: 'Ada Lovelace',
            line1: '1 Analytical Way',
            line2: 'Flat 2',
            city: 'London',
            region: null,
            postalCode: 'N1 1AA',
            country: 'GB',
          },
          lines: [
            {
              productId: '00000000-0000-4000-8000-000000000001',
              sku: 'ESP-001',
              name: 'Espresso Machine',
              unitPriceMinorUnits: 24999,
              quantity: 2,
              lineTotalMinorUnits: 49998,
            },
            {
              productId: '00000000-0000-4000-8000-000000000002',
              sku: 'KET-1',
              name: 'Kettle',
              unitPriceMinorUnits: 1000,
              quantity: 1,
              lineTotalMinorUnits: 1000,
            },
          ],
        });
        expect(found?.number).toBeGreaterThan(0);
        expect(Number.isInteger(found?.number)).toBe(true);
        expect(found?.createdAt).toBeInstanceOf(Date);
        expect(found?.updatedAt).toBeInstanceOf(Date);
      });

      it('does not return a domain aggregate', async () => {
        const order = await store();

        expect(await harness.read.findById(order.id)).not.toBeInstanceOf(Order);
      });

      it('answers null when nothing holds the id', async () => {
        await expect(
          harness.read.findById(OrderId.create()),
        ).resolves.toBeNull();
      });

      it("hides another customer's order behind the same null as a missing one", async () => {
        const order = await store(CUSTOMER);

        await expect(
          harness.read.findById(order.id, OTHER_CUSTOMER),
        ).resolves.toBeNull();
        expect((await harness.read.findById(order.id, CUSTOMER))?.id).toBe(
          order.id.value,
        );
      });

      it('assigns distinct, increasing numbers to successive orders', async () => {
        const first = await store();
        const second = await store();

        const a = await harness.read.findById(first.id);
        const b = await harness.read.findById(second.id);

        expect((b?.number ?? 0) > (a?.number ?? 0)).toBe(true);
      });

      it('reflects a saved transition, moving updatedAt and not createdAt', async () => {
        const order = await store();
        const before = await harness.read.findById(order.id);

        await pay(order);

        const after = await harness.read.findById(order.id);
        expect(after?.status).toBe('paid');
        expect(after?.paidAt).toEqual(NOW);
        expect(after?.createdAt).toEqual(before?.createdAt);
        expect(after?.updatedAt.getTime()).toBeGreaterThan(
          before?.updatedAt.getTime() ?? 0,
        );
      });
    });

    describe('findMany', () => {
      it('returns summaries without lines, newest first', async () => {
        const older = await store();
        const newer = await store();

        const page = await all();

        expect(page.items.map((item) => item.id)).toEqual([
          newer.id.value,
          older.id.value,
        ]);
        expect(page.items[0]).not.toHaveProperty('lines');
        expect(page.items[0]?.lineCount).toBe(2);
      });

      it('filters by customer', async () => {
        await store(CUSTOMER);
        const other = await store(OTHER_CUSTOMER);

        const page = await harness.read.findMany(
          { customerId: OTHER_CUSTOMER },
          { limit: 100, offset: 0 },
        );

        expect(page.items.map((item) => item.id)).toEqual([other.id.value]);
        expect(page.total).toBe(1);
      });

      it('filters by status', async () => {
        const paidOne = await store();
        await store();
        await pay(paidOne);

        const page = await harness.read.findMany(
          { status: 'paid' },
          { limit: 100, offset: 0 },
        );

        expect(page.items.map((item) => item.id)).toEqual([paidOne.id.value]);
      });

      it('reports the total matching count, not the page size', async () => {
        await store();
        await store();
        await store();

        const page = await harness.read.findMany({}, { limit: 2, offset: 0 });

        expect(page.items).toHaveLength(2);
        expect(page).toMatchObject({ total: 3, limit: 2, offset: 0 });
      });

      it('returns an empty page past the end, still carrying the total', async () => {
        await store();

        const page = await harness.read.findMany({}, { limit: 10, offset: 50 });

        expect(page).toMatchObject({ items: [], total: 1 });
      });

      it('reports zero on an empty store', async () => {
        expect(await all()).toMatchObject({ items: [], total: 0 });
      });

      it('pages without repeating or skipping', async () => {
        await store();
        await store();
        await store();

        const first = await harness.read.findMany({}, { limit: 2, offset: 0 });
        const second = await harness.read.findMany({}, { limit: 2, offset: 2 });
        const ids = [...first.items, ...second.items].map((item) => item.id);

        expect(new Set(ids).size).toBe(3);
      });
    });
  });
}
