import { DrizzleProductWriteRepository } from '@/product/infrastructure';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { productWriteRepositoryContract } from './product-write-repository.contract';

productWriteRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleProductWriteRepository(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
