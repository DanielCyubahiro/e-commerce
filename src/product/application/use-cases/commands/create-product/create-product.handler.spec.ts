import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { DuplicateSkuException } from '../../../exceptions/duplicate-sku.exception';
import { CreateProductCommand } from './create-product.command';
import { CreateProductHandler } from './create-product.handler';

describe('CreateProductHandler', () => {
  let repository: InMemoryProductWriteRepository;
  let handler: CreateProductHandler;

  beforeEach(() => {
    repository = new InMemoryProductWriteRepository();
    handler = new CreateProductHandler(repository);
  });

  const command = (sku = 'ESP-001'): CreateProductCommand =>
    new CreateProductCommand(
      'Espresso Machine',
      'Makes espresso.',
      249.99,
      sku,
      12,
      'EUR',
    );

  it('returns the id of the product it stored', async () => {
    const id = await handler.execute(command());

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(repository.snapshot()[0]?.id.value).toBe(id);
  });

  it('stores exactly one product', async () => {
    await handler.execute(command());

    expect(repository.snapshot()).toHaveLength(1);
  });

  it('stores the price as minor units', async () => {
    await handler.execute(command());

    expect(repository.snapshot()[0]?.price.minorUnits).toBe(24999);
  });

  it('uses the currency the command carries', async () => {
    // The default itself lives in CreateProductDto now, so it is asserted in
    // the HTTP suite rather than here.
    await handler.execute(
      new CreateProductCommand('Kettle', 'Boils water.', 10, 'KET-1', 1, 'USD'),
    );

    expect(repository.snapshot()[0]?.price.currency).toBe('USD');
  });

  it('surfaces a duplicate sku from the repository', async () => {
    await handler.execute(command('DUP-1'));

    const error = await catchRejection(
      () => handler.execute(command('DUP-1')),
      DuplicateSkuException,
    );

    expect(error.code).toBe('PRODUCT_SKU_DUPLICATE');
  });

  it('lets exactly one of two identical concurrent creates win', async () => {
    const results = await Promise.allSettled([
      handler.execute(command('RACE-1')),
      handler.execute(command('RACE-1')),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(repository.snapshot()).toHaveLength(1);
  });
});
