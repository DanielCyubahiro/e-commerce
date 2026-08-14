import { InvalidIdentifierException } from '@/shared/domain';
import { Product } from '@/product/domain';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';
import { DeleteProductCommand } from './delete-product.command';
import { DeleteProductHandler } from './delete-product.handler';

const MISSING_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('DeleteProductHandler', () => {
  let repository: InMemoryProductWriteRepository;
  let handler: DeleteProductHandler;

  beforeEach(() => {
    repository = new InMemoryProductWriteRepository();
    handler = new DeleteProductHandler(repository);
  });

  const storedProduct = async (): Promise<Product> => {
    const product = Product.create({
      name: 'Espresso Machine',
      description: 'Makes espresso.',
      price: 249.99,
      currency: 'EUR',
      sku: 'ESP-001',
      stock: 12,
    });
    await repository.add(product);
    return product;
  };

  it('removes a product that exists', async () => {
    const product = await storedProduct();

    await handler.execute(new DeleteProductCommand(product.id.value));

    expect(repository.snapshot()).toHaveLength(0);
  });

  it('throws when no product holds that id', async () => {
    const error = await catchRejection(
      () => handler.execute(new DeleteProductCommand(MISSING_ID)),
      ProductNotFoundException,
    );

    expect(error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects a malformed id before reaching the repository', async () => {
    const error = await catchRejection(
      () => handler.execute(new DeleteProductCommand('not-a-uuid')),
      InvalidIdentifierException,
    );

    expect(error.code).toBe('IDENTIFIER_INVALID');
  });

  it('leaves other products alone', async () => {
    const product = await storedProduct();

    await expect(
      handler.execute(new DeleteProductCommand(MISSING_ID)),
    ).rejects.toThrow();

    expect(repository.snapshot()[0]?.id.equals(product.id)).toBe(true);
  });
});
