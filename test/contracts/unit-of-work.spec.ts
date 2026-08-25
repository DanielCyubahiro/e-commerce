import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import type { Snapshottable } from '@test/fakes/snapshottable';
import { unitOfWorkContract } from './unit-of-work.contract';

/** The smallest possible participant: one counter. */
class CountingStore implements Snapshottable {
  rows = 0;

  capture(): unknown {
    return this.rows;
  }

  restore(captured: unknown): void {
    this.rows = captured as number;
  }
}

const store = new CountingStore();

unitOfWorkContract('fake', () =>
  Promise.resolve({
    uow: new FakeUnitOfWork([store]),
    writeRow: () => {
      store.rows += 1;
      return Promise.resolve();
    },
    rowCount: () => Promise.resolve(store.rows),
    reset: () => {
      store.rows = 0;
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
