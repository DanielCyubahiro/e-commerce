import { InvalidIdentifierException } from '@/shared/domain';
import { Product } from '@/catalogue/domain';
import { InMemoryProductReadRepository } from '@test/fakes/in-memory-product-read.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';
import { GetProductHandler } from './get-product.handler';
import { GetProductQuery } from './get-product.query';

const MISSING_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('GetProductHandler', () => {
  let writes: InMemoryProductWriteRepository;
  let handler: GetProductHandler;

  beforeEach(() => {
    writes = new InMemoryProductWriteRepository();
    handler = new GetProductHandler(new InMemoryProductReadRepository(writes));
  });

  const stored = async (): Promise<Product> => {
    const product = Product.create({
      name: 'Espresso Machine',
      description: 'Makes espresso.',
      price: 249.99,
      currency: 'EUR',
      sku: 'ESP-001',
      stock: 12,
    });
    await writes.add(product);
    return product;
  };

  it('returns a read model, not an aggregate', async () => {
    const product = await stored();

    const result = await handler.execute(new GetProductQuery(product.id.value));

    expect(result).not.toBeInstanceOf(Product);
    expect(result).toMatchObject({
      id: product.id.value,
      priceMinorUnits: 24999,
      priceCurrency: 'EUR',
    });
  });

  it('throws when no product holds that id', async () => {
    const error = await catchRejection(
      () => handler.execute(new GetProductQuery(MISSING_ID)),
      ProductNotFoundException,
    );

    expect(error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects a malformed id before reaching the repository', async () => {
    const error = await catchRejection(
      () => handler.execute(new GetProductQuery('not-a-uuid')),
      InvalidIdentifierException,
    );

    expect(error.code).toBe('IDENTIFIER_INVALID');
  });
});
