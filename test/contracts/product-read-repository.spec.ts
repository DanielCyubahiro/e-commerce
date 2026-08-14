import { InMemoryProductReadRepository } from '@test/fakes/in-memory-product-read.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { productReadRepositoryContract } from './product-read-repository.contract';

const writes = new InMemoryProductWriteRepository();

productReadRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    read: new InMemoryProductReadRepository(writes),
    write: writes,
    reset: () => {
      writes.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
