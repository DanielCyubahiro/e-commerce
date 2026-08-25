import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  asDrizzleTransaction,
  DrizzleUnitOfWork,
} from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { products } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { unitOfWorkContract } from './unit-of-work.contract';

unitOfWorkContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    uow: new DrizzleUnitOfWork(db),
    writeRow: async (tx) => {
      const id = randomUUID();
      await asDrizzleTransaction(tx)
        .insert(products)
        .values({
          id,
          name: 'Unit of work probe',
          description: 'Probes commit and rollback.',
          priceAmount: 1,
          sku: `UOW-${id.slice(0, 8)}`,
          stock: 0,
        });
    },
    rowCount: async () => {
      const rows = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM products`,
      );
      return rows[0]?.count ?? 0;
    },
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
