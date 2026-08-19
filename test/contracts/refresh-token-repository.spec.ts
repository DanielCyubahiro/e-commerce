import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenRepository } from '@test/fakes/in-memory-refresh-token.repository';
import { refreshTokenRepositoryContract } from './refresh-token-repository.contract';

const repository = new InMemoryRefreshTokenRepository();

refreshTokenRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    repository,
    // No users table in the fake: a fresh id plus the seeded role stand in
    // for a user row.
    seedUser: (email, role) => {
      const userId = randomUUID();
      repository.seedUserRole(userId, role);
      return Promise.resolve(userId);
    },
    reset: () => {
      repository.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
