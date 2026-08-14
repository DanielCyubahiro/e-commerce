import {
  DrizzleProductReadRepository,
  DrizzleProductWriteRepository,
} from '@/product/infrastructure';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { productReadRepositoryContract } from './product-read-repository.contract';

productReadRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    read: new DrizzleProductReadRepository(db),
    write: new DrizzleProductWriteRepository(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
