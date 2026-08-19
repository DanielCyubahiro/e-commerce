import { randomUUID } from 'node:crypto';
import { DrizzleRefreshTokenRepository } from '@/identity/infrastructure';
import { users } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { refreshTokenRepositoryContract } from './refresh-token-repository.contract';

refreshTokenRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleRefreshTokenRepository(db),
    seedUser: async (email, role) => {
      const userId = randomUUID();

      // Inserted directly rather than through UserWriteRepository: this
      // harness is for the refresh-token port, and going through another
      // port would make a failure here ambiguous between the two.
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
