import { Product } from '@/catalogue/domain';
import {
  DrizzleProductWriteRepository,
  DrizzleStockAllocator,
} from '@/catalogue/infrastructure';
import { DrizzleUnitOfWork } from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';

/**
 * Concurrency the fake cannot exhibit: it is single-threaded, so an oversell
 * or a deadlock can only be provoked against Postgres.
 */
describe('DrizzleStockAllocator under concurrency', () => {
  const db = testDb();
  const uow = new DrizzleUnitOfWork(db);
  const allocator = new DrizzleStockAllocator();
  const writes = new DrizzleProductWriteRepository(db);

  const seed = async (sku: string, stock: number): Promise<Product> => {
    const product = Product.create({
      name: `Product ${sku}`,
      description: 'Contended.',
      price: 1,
      currency: 'EUR',
      sku,
      stock,
    });
    await writes.add(product);
    return product;
  };

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('never oversells: exactly the affordable number of competing allocations win', async () => {
    const product = await seed('RACE-1', 5);

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () =>
        uow.run((tx) =>
          allocator.allocate(
            [{ productId: product.id.value, quantity: 1 }],
            tx,
          ),
        ),
      ),
    );

    expect(outcomes.filter((o) => o.kind === 'allocated')).toHaveLength(5);
    expect(outcomes.filter((o) => o.kind === 'rejected')).toHaveLength(5);
  });

  it('completes opposite-sequence allocations on shared products without deadlocking', async () => {
    const a = await seed('DL-A', 100);
    const b = await seed('DL-B', 100);
    const forwards = [
      { productId: a.id.value, quantity: 1 },
      { productId: b.id.value, quantity: 1 },
    ];
    const backwards = [...forwards].reverse();

    // Requests are sorted by product id inside `allocate`, so both directions
    // lock A then B (or B then A) identically. Without the sort, Postgres
    // reports 40P01 on roughly half of these runs.
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        uow.run((tx) =>
          allocator.allocate(index % 2 === 0 ? forwards : backwards, tx),
        ),
      ),
    );

    expect(outcomes.every((o) => o.kind === 'allocated')).toBe(true);
  });
});
