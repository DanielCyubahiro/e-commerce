import { randomUUID } from 'node:crypto';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { oneTimeTokenRepositoryContract } from './one-time-token-repository.contract';

const repository = new InMemoryOneTimeTokenRepository();

oneTimeTokenRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    repository,
    // No foreign key in the fake: a fresh id is enough to stand in for a user.
    seedUser: () => Promise.resolve(randomUUID()),
    reset: () => {
      repository.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
