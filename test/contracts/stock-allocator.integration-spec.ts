import { eq } from 'drizzle-orm';
import {
  DrizzleProductWriteRepository,
  DrizzleStockAllocator,
} from '@/catalogue/infrastructure';
import { DrizzleUnitOfWork } from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { products } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { stockAllocatorContract } from './stock-allocator.contract';

stockAllocatorContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    allocator: new DrizzleStockAllocator(),
    products: new DrizzleProductWriteRepository(db),
    stockOf: async (productId) => {
      const rows = await db
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, productId));
      return rows[0]?.stock ?? -1;
    },
    uow: new DrizzleUnitOfWork(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
