import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { userReadRepositoryContract } from './user-read-repository.contract';

const writes = new InMemoryUserWriteRepository();

userReadRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    read: new InMemoryUserReadRepository(writes),
    write: writes,
    promoteToSeller: (id) => {
      writes.promote(id);
      return Promise.resolve();
    },
    reset: () => {
      writes.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
