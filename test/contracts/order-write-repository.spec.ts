import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { orderWriteRepositoryContract } from './order-write-repository.contract';

const repository = new InMemoryOrderWriteRepository();

orderWriteRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    repository,
    uow: new FakeUnitOfWork([repository]),
    reset: () => {
      repository.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
