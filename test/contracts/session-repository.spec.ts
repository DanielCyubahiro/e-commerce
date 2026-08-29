import { randomUUID } from 'node:crypto';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import {
  CONTRACT_LIFETIMES,
  sessionRepositoryContract,
} from './session-repository.contract';

const repository = new InMemorySessionRepository(CONTRACT_LIFETIMES);

sessionRepositoryContract('in-memory fake', () =>
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
