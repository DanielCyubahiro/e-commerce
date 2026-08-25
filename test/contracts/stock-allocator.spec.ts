import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { InMemoryStockAllocator } from '@test/fakes/in-memory-stock-allocator';
import { stockAllocatorContract } from './stock-allocator.contract';

const products = new InMemoryProductWriteRepository();

stockAllocatorContract('in-memory fake', () =>
  Promise.resolve({
    allocator: new InMemoryStockAllocator(products),
    products,
    stockOf: (productId) =>
      Promise.resolve(
        products.snapshot().find((p) => p.id.value === productId)?.stock ?? -1,
      ),
    uow: new FakeUnitOfWork([products]),
    reset: () => {
      products.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
