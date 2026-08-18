import type {
  ProductReadModel,
  ProductReadRepository,
  ProductWriteRepository,
} from '@/product/application';
import { Product, ProductId } from '@/product/domain';
import type { Page } from '@/shared/application';

export interface ReadHarness {
  read: ProductReadRepository;
  /** Seeding goes through the write port, so the contract never assumes how rows are inserted. */
  write: ProductWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export function productReadRepositoryContract(
  name: string,
  makeHarness: () => Promise<ReadHarness>,
): void {
  describe(`ProductReadRepository contract (${name})`, () => {
    let harness: ReadHarness;

    const aProduct = (overrides: {
      sku?: string;
      price?: number;
      currency?: string;
      name?: string;
    }): Product =>
      Product.create({
        name: overrides.name ?? 'Espresso Machine',
        description: 'Makes espresso.',
        price: overrides.price ?? 249.99,
        currency: overrides.currency ?? 'EUR',
        sku: overrides.sku ?? 'ESP-001',
        stock: 12,
      });

    const store = async (overrides: {
      sku?: string;
      price?: number;
      currency?: string;
    }): Promise<Product> => {
      const product = aProduct(overrides);
      await harness.write.add(product);
      return product;
    };

    const allOf = (): Promise<Page<ProductReadModel>> =>
      harness.read.findMany({}, { limit: 100, offset: 0 });

    const replacementFor = (id: ProductId): Product =>
      Product.replace(id, {
        name: 'Replaced Machine',
        description: 'Now with more steam.',
        price: 149.5,
        currency: 'USD',
        sku: 'ESP-002',
        stock: 3,
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

    describe('findById', () => {
      it('returns null when nothing holds that id', async () => {
        await expect(
          harness.read.findById(ProductId.create()),
        ).resolves.toBeNull();
      });

      it('projects every field of a stored product', async () => {
        const product = await store({});

        const found = await harness.read.findById(product.id);

        expect(found).toMatchObject({
          id: product.id.value,
          name: 'Espresso Machine',
          description: 'Makes espresso.',
          priceMinorUnits: 24999,
          priceCurrency: 'EUR',
          sku: 'ESP-001',
          stock: 12,
        });
        expect(found?.createdAt).toBeInstanceOf(Date);
        expect(found?.updatedAt).toBeInstanceOf(Date);
      });

      it('round-trips the smallest representable amount', async () => {
        const product = await store({ price: 0.01 });

        expect((await harness.read.findById(product.id))?.priceMinorUnits).toBe(
          1,
        );
      });

      it('does not return a domain aggregate', async () => {
        const product = await store({});

        expect(await harness.read.findById(product.id)).not.toBeInstanceOf(
          Product,
        );
      });
    });

    describe('after a replace', () => {
      it('projects the replaced values', async () => {
        const product = await store({});

        await harness.write.replace(replacementFor(product.id));

        expect(await harness.read.findById(product.id)).toMatchObject({
          id: product.id.value,
          name: 'Replaced Machine',
          description: 'Now with more steam.',
          priceMinorUnits: 14950,
          priceCurrency: 'USD',
          sku: 'ESP-002',
          stock: 3,
        });
      });

      it('moves updatedAt without moving createdAt', async () => {
        const product = await store({});
        const before = await harness.read.findById(product.id);

        await harness.write.replace(replacementFor(product.id));

        const after = await harness.read.findById(product.id);
        expect(after?.createdAt).toEqual(before?.createdAt);
        expect(after?.updatedAt.getTime()).toBeGreaterThan(
          before?.updatedAt.getTime() ?? 0,
        );
      });

      it('keeps its position in the newest-first order', async () => {
        const older = await store({ sku: 'ORDER-1' });
        const newer = await store({ sku: 'ORDER-2' });

        await harness.write.replace(replacementFor(older.id));

        const page = await allOf();

        expect(page.items.map((item) => item.id)).toEqual([
          newer.id.value,
          older.id.value,
        ]);
      });
    });

    describe('findMany filters', () => {
      it('returns everything when no filter is given', async () => {
        await store({ sku: 'A-1' });
        await store({ sku: 'A-2' });

        expect((await allOf()).total).toBe(2);
      });

      it('treats a zero minimum as a real bound', async () => {
        await store({ sku: 'FREE', price: 0 });
        await store({ sku: 'PAID', price: 10 });

        const page = await harness.read.findMany(
          { minPriceMinorUnits: 0, currency: 'EUR' },
          { limit: 100, offset: 0 },
        );

        expect(page.total).toBe(2);
      });

      it('excludes products below the minimum', async () => {
        await store({ sku: 'CHEAP', price: 5 });
        await store({ sku: 'DEAR', price: 50 });

        const page = await harness.read.findMany(
          { minPriceMinorUnits: 1000, currency: 'EUR' },
          { limit: 100, offset: 0 },
        );

        expect(page.items.map((item) => item.sku)).toEqual(['DEAR']);
      });

      it('excludes products above the maximum', async () => {
        await store({ sku: 'CHEAP', price: 5 });
        await store({ sku: 'DEAR', price: 50 });

        const page = await harness.read.findMany(
          { maxPriceMinorUnits: 1000, currency: 'EUR' },
          { limit: 100, offset: 0 },
        );

        expect(page.items.map((item) => item.sku)).toEqual(['CHEAP']);
      });

      it('includes a product priced exactly on the bound', async () => {
        await store({ sku: 'EXACT', price: 10 });

        const page = await harness.read.findMany(
          {
            minPriceMinorUnits: 1000,
            maxPriceMinorUnits: 1000,
            currency: 'EUR',
          },
          { limit: 100, offset: 0 },
        );

        expect(page.items.map((item) => item.sku)).toEqual(['EXACT']);
      });

      it('confines a price bound to one currency', async () => {
        await store({ sku: 'EUR-1', price: 10, currency: 'EUR' });
        await store({ sku: 'USD-1', price: 10, currency: 'USD' });

        const page = await harness.read.findMany(
          { minPriceMinorUnits: 0, currency: 'USD' },
          { limit: 100, offset: 0 },
        );

        expect(page.items.map((item) => item.sku)).toEqual(['USD-1']);
      });
    });

    describe('findMany pagination', () => {
      const seedThree = async (): Promise<void> => {
        await store({ sku: 'P-1' });
        await store({ sku: 'P-2' });
        await store({ sku: 'P-3' });
      };

      it('reports the total matching count, not the page size', async () => {
        await seedThree();

        const page = await harness.read.findMany({}, { limit: 2, offset: 0 });

        expect(page.items).toHaveLength(2);
        expect(page.total).toBe(3);
      });

      it('echoes the requested window', async () => {
        await seedThree();

        const page = await harness.read.findMany({}, { limit: 2, offset: 1 });

        expect(page).toMatchObject({ limit: 2, offset: 1, total: 3 });
      });

      it('returns an empty page past the end without failing', async () => {
        await seedThree();

        const page = await harness.read.findMany({}, { limit: 2, offset: 99 });

        expect(page.items).toEqual([]);
        expect(page.total).toBe(3);
      });

      it('reports zero total on an empty store', async () => {
        expect(
          await harness.read.findMany({}, { limit: 10, offset: 0 }),
        ).toMatchObject({ items: [], total: 0 });
      });

      it('returns the newest product first', async () => {
        await seedThree();

        expect((await allOf()).items[0]?.sku).toBe('P-3');
      });

      it('pages without repeating or skipping a row', async () => {
        await seedThree();

        const first = await harness.read.findMany({}, { limit: 2, offset: 0 });
        const second = await harness.read.findMany({}, { limit: 2, offset: 2 });
        const seen = [...first.items, ...second.items].map((item) => item.sku);

        expect(seen).toHaveLength(3);
        expect(new Set(seen).size).toBe(3);
      });

      it('counts only rows matching the filter', async () => {
        await store({ sku: 'CHEAP', price: 5 });
        await store({ sku: 'DEAR', price: 50 });

        const page = await harness.read.findMany(
          { minPriceMinorUnits: 1000, currency: 'EUR' },
          { limit: 1, offset: 0 },
        );

        expect(page.total).toBe(1);
      });
    });
  });
}
