import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { productWriteRepositoryContract } from './product-write-repository.contract';

const repository = new InMemoryProductWriteRepository();

productWriteRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    repository,
    reset: () => {
      repository.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
