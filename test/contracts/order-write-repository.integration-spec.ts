import { DrizzleOrderWriteRepository } from '@/ordering/infrastructure';
import { DrizzleUnitOfWork } from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { orderWriteRepositoryContract } from './order-write-repository.contract';

orderWriteRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleOrderWriteRepository(db),
    uow: new DrizzleUnitOfWork(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
