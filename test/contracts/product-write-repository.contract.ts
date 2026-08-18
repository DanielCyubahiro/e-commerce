import {
  DuplicateSkuException,
  type ProductWriteRepository,
} from '@/product/application';
import { Product, ProductId } from '@/product/domain';
import { catchRejection } from '@test/support/catch-error';

export interface WriteHarness {
  repository: ProductWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Run against every implementation of the port, including the in-memory fake. A
 * fake that quietly diverges from the adapter turns a green suite into a
 * liability, so divergence has to be a test failure rather than a surprise.
 */
export function productWriteRepositoryContract(
  name: string,
  makeHarness: () => Promise<WriteHarness>,
): void {
  describe(`ProductWriteRepository contract (${name})`, () => {
    let harness: WriteHarness;

    const aProduct = (sku = 'ESP-001'): Product =>
      Product.create({
        name: 'Espresso Machine',
        description: 'Makes espresso.',
        price: 249.99,
        currency: 'EUR',
        sku,
        stock: 12,
      });

    const replacementFor = (id: ProductId, sku: string): Product =>
      Product.replace(id, {
        name: 'Replaced Machine',
        description: 'Replaced.',
        price: 99.95,
        currency: 'EUR',
        sku,
        stock: 1,
      });

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('stores a product, evidenced by a delete that finds it', async () => {
      const product = aProduct();

      await harness.repository.add(product);

      await expect(harness.repository.delete(product.id)).resolves.toBe(true);
    });

    it('accepts products with different skus', async () => {
      await harness.repository.add(aProduct('A-1'));

      await expect(
        harness.repository.add(aProduct('A-2')),
      ).resolves.toBeUndefined();
    });

    it('rejects a second product with the same sku', async () => {
      await harness.repository.add(aProduct('DUP-1'));

      const error = await catchRejection(
        () => harness.repository.add(aProduct('DUP-1')),
        DuplicateSkuException,
      );

      expect(error.code).toBe('PRODUCT_SKU_DUPLICATE');
    });

    it('rejects a duplicate sku regardless of the case supplied', async () => {
      await harness.repository.add(aProduct('dup-2'));

      const error = await catchRejection(
        () => harness.repository.add(aProduct('DUP-2')),
        DuplicateSkuException,
      );

      expect(error.code).toBe('PRODUCT_SKU_DUPLICATE');
    });

    it('reports false when deleting an id it does not hold', async () => {
      await expect(harness.repository.delete(ProductId.create())).resolves.toBe(
        false,
      );
    });

    it('reports false on a second delete of the same id', async () => {
      const product = aProduct();
      await harness.repository.add(product);
      await harness.repository.delete(product.id);

      await expect(harness.repository.delete(product.id)).resolves.toBe(false);
    });

    it('leaves other products alone when one is deleted', async () => {
      const kept = aProduct('KEEP-1');
      const removed = aProduct('GONE-1');
      await harness.repository.add(kept);
      await harness.repository.add(removed);

      await harness.repository.delete(removed.id);

      await expect(harness.repository.delete(kept.id)).resolves.toBe(true);
    });

    it('reports true when a product held that id', async () => {
      const product = aProduct();
      await harness.repository.add(product);

      await expect(
        harness.repository.replace(replacementFor(product.id, 'ESP-002')),
      ).resolves.toBe(true);
    });

    it('reports false when no product holds that id', async () => {
      await expect(
        harness.repository.replace(
          replacementFor(ProductId.create(), 'ESP-003'),
        ),
      ).resolves.toBe(false);
    });

    it('rejects a sku another product already holds', async () => {
      const other = aProduct('TAKEN-1');
      const target = aProduct('TARGET-1');
      await harness.repository.add(other);
      await harness.repository.add(target);

      const error = await catchRejection(
        () => harness.repository.replace(replacementFor(target.id, 'TAKEN-1')),
        DuplicateSkuException,
      );

      expect(error.code).toBe('PRODUCT_SKU_DUPLICATE');
    });

    it('accepts a replacement that keeps the product its own sku', async () => {
      const product = aProduct('SAME-1');
      await harness.repository.add(product);

      await expect(
        harness.repository.replace(replacementFor(product.id, 'SAME-1')),
      ).resolves.toBe(true);
    });

    it('leaves other products alone when one is replaced', async () => {
      const kept = aProduct('KEEP-2');
      const target = aProduct('TARGET-2');
      await harness.repository.add(kept);
      await harness.repository.add(target);

      await harness.repository.replace(replacementFor(target.id, 'TARGET-2B'));

      await expect(harness.repository.delete(kept.id)).resolves.toBe(true);
    });
  });
}
