import {
  type ProductWriteRepository,
  type StockAllocator,
} from '@/catalogue/application';
import { Product } from '@/catalogue/domain';
import type { UnitOfWork } from '@/shared/application';

export interface StockAllocatorHarness {
  allocator: StockAllocator;
  /** Seeding goes through catalogue's own write port. */
  products: ProductWriteRepository;
  stockOf(productId: string): Promise<number>;
  uow: UnitOfWork;
  reset(): Promise<void>;
  close(): Promise<void>;
}

class RollBack extends Error {
  constructor() {
    super('roll back');
    this.name = 'RollBack';
  }
}

export function stockAllocatorContract(
  name: string,
  makeHarness: () => Promise<StockAllocatorHarness>,
): void {
  describe(`StockAllocator contract (${name})`, () => {
    let harness: StockAllocatorHarness;

    const seed = async (
      sku: string,
      stock: number,
      price = 10,
    ): Promise<Product> => {
      const product = Product.create({
        name: `Product ${sku}`,
        description: `Described ${sku}.`,
        price,
        currency: 'EUR',
        sku,
        stock,
      });
      await harness.products.add(product);
      return product;
    };

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('returns the product snapshot with each allocation, in product id order', async () => {
      const a = await seed('A-1', 10, 19.99);
      const b = await seed('B-1', 10, 5);
      const sorted = [a, b].sort((l, r) =>
        l.id.value.localeCompare(r.id.value),
      );

      const outcome = await harness.uow.run((tx) =>
        harness.allocator.allocate(
          [
            { productId: b.id.value, quantity: 2 },
            { productId: a.id.value, quantity: 3 },
          ],
          tx,
        ),
      );

      expect(outcome).toEqual({
        kind: 'allocated',
        lines: sorted.map((product) => ({
          productId: product.id.value,
          sku: product.sku.value,
          name: product.name,
          unitPriceMinorUnits: product.price.minorUnits,
          currency: 'EUR',
          quantity: product.id.equals(a.id) ? 3 : 2,
        })),
      });
    });

    it('decrements stock by the allocated quantity', async () => {
      const product = await seed('DEC-1', 12);

      await harness.uow.run((tx) =>
        harness.allocator.allocate(
          [{ productId: product.id.value, quantity: 5 }],
          tx,
        ),
      );

      await expect(harness.stockOf(product.id.value)).resolves.toBe(7);
    });

    it('allocates exactly the stock on hand, leaving zero', async () => {
      const product = await seed('ALL-1', 4);

      const outcome = await harness.uow.run((tx) =>
        harness.allocator.allocate(
          [{ productId: product.id.value, quantity: 4 }],
          tx,
        ),
      );

      expect(outcome.kind).toBe('allocated');
      await expect(harness.stockOf(product.id.value)).resolves.toBe(0);
    });

    it('rejects a request for more than is on hand, reporting what is', async () => {
      const product = await seed('SHORT-1', 2);

      const outcome = await harness.uow.run((tx) =>
        harness.allocator.allocate(
          [{ productId: product.id.value, quantity: 3 }],
          tx,
        ),
      );

      expect(outcome).toEqual({
        kind: 'rejected',
        shortfalls: [
          { productId: product.id.value, reason: 'insufficient', available: 2 },
        ],
      });
    });

    it('rejects an unknown product with no available count', async () => {
      const missing = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

      const outcome = await harness.uow.run((tx) =>
        harness.allocator.allocate([{ productId: missing, quantity: 1 }], tx),
      );

      expect(outcome).toEqual({
        kind: 'rejected',
        shortfalls: [
          { productId: missing, reason: 'unknown', available: null },
        ],
      });
    });

    it('reports every shortfall of a mixed request, not the first', async () => {
      const enough = await seed('OK-1', 10);
      const short = await seed('SHORT-2', 1);
      const missing = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

      const outcome = await harness.uow.run((tx) =>
        harness.allocator.allocate(
          [
            { productId: enough.id.value, quantity: 1 },
            { productId: short.id.value, quantity: 2 },
            { productId: missing, quantity: 1 },
          ],
          tx,
        ),
      );

      expect(outcome.kind).toBe('rejected');
      // Narrowed outside the assertions themselves: `jest/no-conditional-expect`
      // forbids an `expect` inside the `if` that the union would otherwise need.
      const shortfalls = outcome.kind === 'rejected' ? outcome.shortfalls : [];
      expect(shortfalls).toHaveLength(2);
      expect(shortfalls.map((s) => s.reason).sort()).toEqual([
        'insufficient',
        'unknown',
      ]);
    });

    it('a rejected allocation the caller rolls back leaves every stock as it was', async () => {
      const enough = await seed('OK-2', 10);
      const short = await seed('SHORT-3', 1);

      await expect(
        harness.uow.run(async (tx) => {
          const outcome = await harness.allocator.allocate(
            [
              { productId: enough.id.value, quantity: 4 },
              { productId: short.id.value, quantity: 2 },
            ],
            tx,
          );
          if (outcome.kind === 'rejected') {
            throw new RollBack();
          }
        }),
      ).rejects.toBeInstanceOf(RollBack);

      await expect(harness.stockOf(enough.id.value)).resolves.toBe(10);
      await expect(harness.stockOf(short.id.value)).resolves.toBe(1);
    });

    it('release adds the quantity back', async () => {
      const product = await seed('REL-1', 10);
      await harness.uow.run((tx) =>
        harness.allocator.allocate(
          [{ productId: product.id.value, quantity: 6 }],
          tx,
        ),
      );

      await harness.uow.run((tx) =>
        harness.allocator.release(
          [{ productId: product.id.value, quantity: 6 }],
          tx,
        ),
      );

      await expect(harness.stockOf(product.id.value)).resolves.toBe(10);
    });

    it('release of a product nothing holds is a no-op', async () => {
      const kept = await seed('KEEP-1', 3);

      await expect(
        harness.uow.run((tx) =>
          harness.allocator.release(
            [
              {
                productId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
                quantity: 5,
              },
            ],
            tx,
          ),
        ),
      ).resolves.toBeUndefined();

      await expect(harness.stockOf(kept.id.value)).resolves.toBe(3);
    });
  });
}
