import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { userWriteRepositoryContract } from './user-write-repository.contract';

const repository = new InMemoryUserWriteRepository();

userWriteRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    repository,
    reset: () => {
      repository.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
