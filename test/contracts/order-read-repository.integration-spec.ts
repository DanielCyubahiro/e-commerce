import {
  DrizzleOrderReadRepository,
  DrizzleOrderWriteRepository,
} from '@/ordering/infrastructure';
import { DrizzleUnitOfWork } from '@/shared/infrastructure/database/postgres/drizzle-unit-of-work';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { orderReadRepositoryContract } from './order-read-repository.contract';

orderReadRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    read: new DrizzleOrderReadRepository(db),
    write: new DrizzleOrderWriteRepository(db),
    uow: new DrizzleUnitOfWork(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
