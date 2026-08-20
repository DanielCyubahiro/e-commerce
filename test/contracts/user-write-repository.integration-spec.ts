import { DrizzleUserWriteRepository } from '@/identity/infrastructure';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { userWriteRepositoryContract } from './user-write-repository.contract';

userWriteRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleUserWriteRepository(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
