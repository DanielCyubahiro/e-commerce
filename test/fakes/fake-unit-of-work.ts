import { AsyncLocalStorage } from 'node:async_hooks';
import type { Transaction, UnitOfWork } from '@/shared/application';
import type { Snapshottable } from './snapshottable';

const FAKE_TRANSACTION: Transaction = { __brand: 'Transaction' };

/**
 * Rollback by snapshot: every participant is captured before `work` runs and
 * restored if it throws. Held to the same contract as the Drizzle adapter, so
 * a handler spec that asserts "stock is unchanged after a rejected placement"
 * is asserting something the real transaction also guarantees.
 *
 * Not safe under concurrent `run` calls: a restore puts back a capture taken
 * before another run's commit. Handler specs run one command at a time.
 */
export class FakeUnitOfWork implements UnitOfWork {
  private readonly depth = new AsyncLocalStorage<true>();

  constructor(private readonly participants: Snapshottable[]) {}

  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    if (this.depth.getStore()) {
      return Promise.reject(new Error('UnitOfWork.run cannot be nested.'));
    }

    const captured = this.participants.map((participant) =>
      participant.capture(),
    );

    return this.depth.run(true, async () => {
      try {
        return await work(FAKE_TRANSACTION);
      } catch (error) {
        this.participants.forEach((participant, index) =>
          participant.restore(captured[index]),
        );
        throw error;
      }
    });
  }
}
