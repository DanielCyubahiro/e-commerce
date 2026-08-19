import { randomUUID } from 'node:crypto';
import { DrizzleCredentialRepository } from '@/identity/infrastructure';
import {
  credentials,
  users,
} from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { credentialRepositoryContract } from './credential-repository.contract';

credentialRepositoryContract('drizzle adapter', () => {
  const db = testDb();

  return Promise.resolve({
    repository: new DrizzleCredentialRepository(db),
    seed: async (input) => {
      const userId = randomUUID();

      // Inserted directly rather than through UserWriteRepository: this harness
      // is for the credential port, and going through another port would make a
      // failure here ambiguous between the two.
      await db.insert(users).values({
        id: userId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: input.email,
        role: input.role as 'customer' | 'seller',
        phone: null,
      });
      await db.insert(credentials).values({
        userId,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
      });

      return userId;
    },
    reset: () => truncateAll(db),
    close: () => closeTestDb(),
  });
});
