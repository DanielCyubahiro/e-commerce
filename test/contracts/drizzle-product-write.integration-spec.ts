import { DuplicateSkuException } from '@/catalogue/application';
import { Product } from '@/catalogue/domain';
import { DrizzleProductWriteRepository } from '@/catalogue/infrastructure';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';

/**
 * Adapter-specific behaviour that the shared contract cannot express, because the
 * in-memory fake has no column types to violate.
 */
describe('DrizzleProductWriteRepository', () => {
  const db = testDb();
  const repository = new DrizzleProductWriteRepository(db);

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('propagates a database error that is not a duplicate sku', async () => {
    // stock exceeds int4, so Postgres raises 22003 rather than 23505. If
    // isDuplicateSku were matching on the code alone, or swallowing everything,
    // this would surface to a client as a misleading 409.
    const product = Product.create({
      name: 'Overflowing Widget',
      description: 'More stock than an integer holds.',
      price: 1,
      currency: 'EUR',
      sku: 'OVERFLOW-1',
      stock: 3_000_000_000,
    });

    await expect(repository.add(product)).rejects.not.toBeInstanceOf(
      DuplicateSkuException,
    );
  });

  it('still reports a genuine duplicate sku as DuplicateSkuException', async () => {
    const first = Product.create({
      name: 'Widget',
      description: 'A widget.',
      price: 1,
      currency: 'EUR',
      sku: 'SAME-SKU',
      stock: 1,
    });
    const second = Product.create({
      name: 'Different Widget',
      description: 'Also a widget.',
      price: 2,
      currency: 'EUR',
      sku: 'SAME-SKU',
      stock: 2,
    });

    await repository.add(first);

    await expect(repository.add(second)).rejects.toBeInstanceOf(
      DuplicateSkuException,
    );
  });
});
