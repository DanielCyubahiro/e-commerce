import type { Transaction, UnitOfWork } from '@/shared/application';

export interface UnitOfWorkHarness {
  uow: UnitOfWork;
  /** Writes one row into whatever store the binding uses, inside `tx`. */
  writeRow(tx: Transaction): Promise<void>;
  rowCount(): Promise<number>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

class Boom extends Error {
  constructor() {
    super('boom');
    this.name = 'Boom';
  }
}

/**
 * Run against the Drizzle adapter and the snapshot-restoring fake alike, so a
 * handler spec that relies on the fake rolling back is relying on something
 * the real adapter has been shown to do too.
 */
export function unitOfWorkContract(
  name: string,
  makeHarness: () => Promise<UnitOfWorkHarness>,
): void {
  describe(`UnitOfWork contract (${name})`, () => {
    let harness: UnitOfWorkHarness;

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('returns what the work returned', async () => {
      await expect(harness.uow.run(() => Promise.resolve(42))).resolves.toBe(
        42,
      );
    });

    it('commits a write made inside the work', async () => {
      await harness.uow.run((tx) => harness.writeRow(tx));

      await expect(harness.rowCount()).resolves.toBe(1);
    });

    it('rolls back every write when the work throws', async () => {
      await expect(
        harness.uow.run(async (tx) => {
          await harness.writeRow(tx);
          await harness.writeRow(tx);
          throw new Boom();
        }),
      ).rejects.toBeInstanceOf(Boom);

      await expect(harness.rowCount()).resolves.toBe(0);
    });

    it('propagates the thrown error itself, not a wrapper', async () => {
      const boom = new Boom();

      await expect(harness.uow.run(() => Promise.reject(boom))).rejects.toBe(
        boom,
      );
    });

    it('leaves earlier committed work alone when a later run fails', async () => {
      await harness.uow.run((tx) => harness.writeRow(tx));

      await expect(
        harness.uow.run(async (tx) => {
          await harness.writeRow(tx);
          throw new Boom();
        }),
      ).rejects.toBeInstanceOf(Boom);

      await expect(harness.rowCount()).resolves.toBe(1);
    });

    it('rejects a nested run', async () => {
      await expect(
        harness.uow.run(() => harness.uow.run(() => Promise.resolve(1))),
      ).rejects.toThrow(/nested/);
    });
  });
}
