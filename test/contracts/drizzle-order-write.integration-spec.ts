import { sql } from 'drizzle-orm';
import { DrizzleOrderWriteRepository } from '@/ordering/infrastructure';
import { type Order } from '@/ordering/domain';
import { DrizzleUnitOfWork } from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { anOrder } from './order-write-repository.contract';

/**
 * Adapter-specific behaviour the shared contract cannot express: the fake has
 * no trigger and no identity sequence.
 */
describe('DrizzleOrderWriteRepository', () => {
  const db = testDb();
  const repository = new DrizzleOrderWriteRepository(db);
  const uow = new DrizzleUnitOfWork(db);

  const place = (order: Order) =>
    uow.run((tx) => repository.place({ order, idempotencyKey: null }, tx));

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('leaves updated_at to the trigger, which moves it on save', async () => {
    const order = anOrder();
    await place(order);
    const loaded = (await repository.findById(order.id)) as Order;
    loaded.pay(new Date());

    await repository.save(loaded);

    const rows = await db.execute<{ moved: boolean }>(sql`
      SELECT updated_at > created_at AS moved FROM orders WHERE id = ${order.id.value}
    `);
    expect(rows[0]?.moved).toBe(true);
  });

  it('never writes number; the identity column assigns it from 1 after a truncate', async () => {
    const first = anOrder();
    const second = anOrder();
    await place(first);
    await place(second);

    const rows = await db.execute<{ id: string; number: number }>(sql`
      SELECT id, number::int AS number FROM orders ORDER BY number
    `);

    expect(rows).toEqual([
      { id: first.id.value, number: 1 },
      { id: second.id.value, number: 2 },
    ]);
  });

  it("writes one line row per line with the order's currency implied", async () => {
    const order = anOrder();
    await place(order);

    const rows = await db.execute<{ count: number; total: number }>(sql`
      SELECT count(*)::int AS count, sum(line_total_amount)::int AS total
      FROM order_lines WHERE order_id = ${order.id.value}
    `);

    expect(rows[0]).toEqual({ count: 2, total: 50998 });
  });
});
