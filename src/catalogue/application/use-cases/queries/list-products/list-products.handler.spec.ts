import { InvalidMoneyException } from '@/shared/domain';
import { Product } from '@/catalogue/domain';
import { InMemoryProductReadRepository } from '@test/fakes/in-memory-product-read.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { catchRejection } from '@test/support/catch-error';
import { ListProductsHandler } from './list-products.handler';
import { ListProductsQuery } from './list-products.query';

describe('ListProductsHandler', () => {
  let writes: InMemoryProductWriteRepository;
  let handler: ListProductsHandler;

  beforeEach(() => {
    writes = new InMemoryProductWriteRepository();
    handler = new ListProductsHandler(
      new InMemoryProductReadRepository(writes),
    );
  });

  const store = async (
    sku: string,
    price: number,
    currency = 'EUR',
  ): Promise<void> => {
    await writes.add(
      Product.create({
        name: 'Espresso Machine',
        description: 'Makes espresso.',
        price,
        currency,
        sku,
        stock: 1,
      }),
    );
  };

  it('converts decimal price bounds into minor units', async () => {
    await store('CHEAP', 5);
    await store('DEAR', 50);

    const page = await handler.execute(
      new ListProductsQuery(
        { minPrice: 10, currency: 'EUR' },
        { limit: 100, offset: 0 },
      ),
    );

    expect(page.items.map((item) => item.sku)).toEqual(['DEAR']);
  });

  it('treats a zero bound as a real bound', async () => {
    await store('FREE', 0);

    const page = await handler.execute(
      new ListProductsQuery(
        { minPrice: 0, currency: 'EUR' },
        { limit: 100, offset: 0 },
      ),
    );

    expect(page.total).toBe(1);
  });

  it('converts a fractional bound exactly', async () => {
    await store('EXACT', 19.99);

    const page = await handler.execute(
      new ListProductsQuery(
        { minPrice: 19.99, maxPrice: 19.99, currency: 'EUR' },
        { limit: 100, offset: 0 },
      ),
    );

    expect(page.items.map((item) => item.sku)).toEqual(['EXACT']);
  });

  it('assumes EUR for a direct caller that gives a bound without a currency', async () => {
    // Unreachable through HTTP, where the query DTO requires a currency
    // alongside any bound. It exists so the conversion is total.
    await store('EUR-1', 10, 'EUR');

    const page = await handler.execute(
      new ListProductsQuery({ minPrice: 5 }, { limit: 100, offset: 0 }),
    );

    expect(page.items.map((item) => item.sku)).toEqual(['EUR-1']);
  });

  it('passes pagination straight through', async () => {
    await store('A-1', 1);
    await store('A-2', 2);

    const page = await handler.execute(
      new ListProductsQuery({}, { limit: 1, offset: 0 }),
    );

    expect(page).toMatchObject({ limit: 1, offset: 0, total: 2 });
    expect(page.items).toHaveLength(1);
  });

  it('returns everything when no filter is given', async () => {
    await store('A-1', 1);
    await store('A-2', 2);

    const page = await handler.execute(
      new ListProductsQuery({}, { limit: 100, offset: 0 }),
    );

    expect(page.total).toBe(2);
  });

  it('rejects a bound with more precision than the currency has', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new ListProductsQuery(
            { minPrice: 1.005, currency: 'EUR' },
            { limit: 10, offset: 0 },
          ),
        ),
      InvalidMoneyException,
    );

    expect(error.code).toBe('MONEY_INVALID');
  });
});
