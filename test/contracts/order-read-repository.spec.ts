import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemoryOrderReadRepository } from '@test/fakes/in-memory-order-read.repository';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { orderReadRepositoryContract } from './order-read-repository.contract';

const writes = new InMemoryOrderWriteRepository();

orderReadRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    read: new InMemoryOrderReadRepository(writes),
    write: writes,
    uow: new FakeUnitOfWork([writes]),
    reset: () => {
      writes.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
