import { randomUUID } from 'node:crypto';
import { DrizzleOneTimeTokenRepository } from '@/identity/infrastructure';
import { users } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { oneTimeTokenRepositoryContract } from './one-time-token-repository.contract';

oneTimeTokenRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleOneTimeTokenRepository(db),
    seedUser: async (email) => {
      const userId = randomUUID();

      // Inserted directly rather than through UserWriteRepository: this
      // harness is for the one-time-token port, and going through another
      // port would make a failure here ambiguous between the two.
      await db.insert(users).values({
        id: userId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email,
        role: 'customer',
        phone: null,
      });

      return userId;
    },
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
