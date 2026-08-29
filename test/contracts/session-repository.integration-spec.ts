import { randomUUID } from 'node:crypto';
import { DrizzleSessionRepository } from '@/identity/infrastructure';
import { users } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import {
  CONTRACT_LIFETIMES,
  sessionRepositoryContract,
} from './session-repository.contract';

sessionRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleSessionRepository(db, CONTRACT_LIFETIMES),
    seedUser: async (email, role) => {
      const userId = randomUUID();

      // Inserted directly rather than through UserWriteRepository: this
      // harness is for the session port, and going through another port
      // would make a failure here ambiguous between the two.
      await db.insert(users).values({
        id: userId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email,
        role: role as 'customer' | 'seller',
        phone: null,
      });

      return userId;
    },
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
