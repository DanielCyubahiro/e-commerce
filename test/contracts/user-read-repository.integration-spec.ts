import { eq } from 'drizzle-orm';
import {
  DrizzleUserReadRepository,
  DrizzleUserWriteRepository,
} from '@/identity/infrastructure';
import { users } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { userReadRepositoryContract } from './user-read-repository.contract';

userReadRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    read: new DrizzleUserReadRepository(db),
    write: new DrizzleUserWriteRepository(db),
    // The operator statement from the README, verbatim in intent.
    promoteToSeller: async (id) => {
      await db
        .update(users)
        .set({ role: 'seller' })
        .where(eq(users.id, id.value));
    },
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
