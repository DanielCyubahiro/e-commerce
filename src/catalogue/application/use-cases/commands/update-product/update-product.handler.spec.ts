import { InvalidIdentifierException } from '@/shared/domain';
import {
  InvalidProductNameException,
  Product,
  type ProductInput,
} from '@/catalogue/domain';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { DuplicateSkuException } from '../../../exceptions/duplicate-sku.exception';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';
import { UpdateProductCommand } from './update-product.command';
import { UpdateProductHandler } from './update-product.handler';

const MISSING_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('UpdateProductHandler', () => {
  let repository: InMemoryProductWriteRepository;
  let handler: UpdateProductHandler;

  beforeEach(() => {
    repository = new InMemoryProductWriteRepository();
    handler = new UpdateProductHandler(repository);
  });

  const fields = (overrides: Partial<ProductInput> = {}): ProductInput => ({
    name: 'Espresso Machine II',
    description: 'Makes more espresso.',
    price: 199.5,
    currency: 'EUR',
    sku: 'ESP-002',
    stock: 3,
    ...overrides,
  });

  const storedProduct = async (sku = 'ESP-001'): Promise<Product> => {
    const product = Product.create({
      name: 'Espresso Machine',
      description: 'Makes espresso.',
      price: 249.99,
      currency: 'EUR',
      sku,
      stock: 12,
    });
    await repository.add(product);
    return product;
  };

  it('replaces every field of the stored product', async () => {
    const product = await storedProduct();

    await handler.execute(new UpdateProductCommand(product.id.value, fields()));

    const stored = repository.snapshot()[0];
    expect(stored?.name).toBe('Espresso Machine II');
    expect(stored?.description).toBe('Makes more espresso.');
    expect(stored?.price.minorUnits).toBe(19950);
    expect(stored?.sku.value).toBe('ESP-002');
    expect(stored?.stock).toBe(3);
  });

  it('keeps the id it was given', async () => {
    const product = await storedProduct();

    await handler.execute(new UpdateProductCommand(product.id.value, fields()));

    expect(repository.snapshot()[0]?.id.equals(product.id)).toBe(true);
  });

  it('stores no additional product', async () => {
    const product = await storedProduct();

    await handler.execute(new UpdateProductCommand(product.id.value, fields()));

    expect(repository.snapshot()).toHaveLength(1);
  });

  it('throws when no product holds that id', async () => {
    const error = await catchRejection(
      () => handler.execute(new UpdateProductCommand(MISSING_ID, fields())),
      ProductNotFoundException,
    );

    expect(error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects a malformed id before reaching the repository', async () => {
    const error = await catchRejection(
      () => handler.execute(new UpdateProductCommand('not-a-uuid', fields())),
      InvalidIdentifierException,
    );

    expect(error.code).toBe('IDENTIFIER_INVALID');
  });

  it('reports a broken invariant rather than a missing product', async () => {
    // The aggregate is built before the store is touched, so validity is
    // decided first even when nothing holds the id.
    const error = await catchRejection(
      () =>
        handler.execute(
          new UpdateProductCommand(MISSING_ID, fields({ name: 'a' })),
        ),
      InvalidProductNameException,
    );

    expect(error.code).toBe('PRODUCT_NAME_INVALID');
  });

  it('surfaces a duplicate sku from the repository', async () => {
    await storedProduct('TAKEN-1');
    const target = await storedProduct('TARGET-1');

    const error = await catchRejection(
      () =>
        handler.execute(
          new UpdateProductCommand(target.id.value, fields({ sku: 'TAKEN-1' })),
        ),
      DuplicateSkuException,
    );

    expect(error.code).toBe('PRODUCT_SKU_DUPLICATE');
  });
});
