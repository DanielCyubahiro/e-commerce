import {
  DrizzleUserReadRepository,
  DrizzleUserWriteRepository,
} from '@/user/infrastructure';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { userReadRepositoryContract } from './user-read-repository.contract';

userReadRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    read: new DrizzleUserReadRepository(db),
    write: new DrizzleUserWriteRepository(db),
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
