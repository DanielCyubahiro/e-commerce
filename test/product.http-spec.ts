import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  PRODUCT_READ_REPOSITORY,
  PRODUCT_WRITE_REPOSITORY,
} from '@/catalogue/application';
import { CatalogueModule } from '@/catalogue/catalogue.module';
import { ACCESS_TOKEN_ISSUER } from '@/identity/application';
import { JwtAuthGuard } from '@/identity/presentation/guards/jwt-auth.guard';
import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { InMemoryProductReadRepository } from '@test/fakes/in-memory-product-read.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';

const MISSING_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const ALLOWED_ORIGIN = 'http://localhost:5173';

/**
 * supertest types `body` as `any`, so asserting on it directly is unchecked.
 * Every field is optional because one shape covers products, errors, and pages.
 */
interface ResponseBody {
  id?: string;
  name?: string;
  code?: string;
  price?: number;
  currency?: string;
  sku?: string;
  stock?: number;
  createdAt?: string;
  priceMinorUnits?: number;
  items?: { sku: string }[];
  total?: number;
  limit?: number;
  offset?: number;
}

const bodyOf = (response: request.Response): ResponseBody =>
  response.body as ResponseBody;

const validBody = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  name: 'Espresso Machine',
  description: 'Makes espresso.',
  price: 249.99,
  sku: 'ESP-001',
  stock: 12,
  currency: 'EUR',
  ...overrides,
});

// CatalogueModule carries no guard of its own; identity.module.ts is the only
// place JwtAuthGuard is normally wired in, so this suite wires it by hand,
// the same way production wiring reaches every context through APP_GUARD.
const issuer = new FakeAccessTokenIssuer();

describe('products HTTP contract', () => {
  let app: INestApplication<App>;
  let authHeader: string;

  beforeAll(async () => {
    const { token } = await issuer.issue({
      userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      role: 'seller',
      sessionId: '9c858901-8a57-4791-81fe-4c455b099bc9',
    });
    authHeader = `Bearer ${token}`;
  });

  beforeEach(async () => {
    const writes = new InMemoryProductWriteRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [CatalogueModule],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: ACCESS_TOKEN_ISSUER, useValue: issuer },
      ],
    })
      .overrideProvider(PRODUCT_WRITE_REPOSITORY)
      .useValue(writes)
      .overrideProvider(PRODUCT_READ_REPOSITORY)
      .useValue(new InMemoryProductReadRepository(writes))
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
      { allowedOrigin: ALLOWED_ORIGIN },
    );
    // Listening on an OS-assigned port, rather than app.init(), stops
    // supertest from opening and closing an ephemeral listener on every
    // request across this suite's many cases.
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  const create = (overrides: Record<string, unknown> = {}): request.Test =>
    request(app.getHttpServer())
      .post('/products')
      .set('Authorization', authHeader)
      .send(validBody(overrides));

  const get = (path: string): request.Test =>
    request(app.getHttpServer()).get(path);

  describe('POST /products', () => {
    it('returns 201 with the new id and a Location header', async () => {
      const response = await create();

      expect(response.status).toBe(201);
      expect(bodyOf(response).id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(response.headers.location).toBe(
        `/products/${bodyOf(response).id ?? ''}`,
      );
    });

    it('defaults the currency to EUR when omitted', async () => {
      const created = await create({ currency: undefined });

      const found = await get(`/products/${bodyOf(created).id ?? ''}`);

      expect(bodyOf(found).currency).toBe('EUR');
    });

    it('returns 400 when a required field is missing', async () => {
      expect((await create({ name: undefined })).status).toBe(400);
    });

    it('returns 400 for an unknown property', async () => {
      expect((await create({ isAdmin: true })).status).toBe(400);
    });

    it('returns 400 when a field has the wrong type', async () => {
      expect((await create({ price: 'free' })).status).toBe(400);
    });

    it('returns 400 when stock is fractional', async () => {
      // @IsInt() catches this at the edge, so the domain's InvalidStockException
      // never runs here. It still guards non-HTTP callers.
      expect((await create({ stock: 1.5 })).status).toBe(400);
    });

    it('returns 400 for an empty name rather than reaching the domain', async () => {
      expect((await create({ name: '' })).status).toBe(400);
    });

    it('returns 422 with a typed code when the domain rejects the name', async () => {
      const response = await create({ name: 'a' });

      expect(response.status).toBe(422);
      expect(bodyOf(response).code).toBe('PRODUCT_NAME_INVALID');
    });

    it('returns 422 when the price carries more than two decimals', async () => {
      const response = await create({ price: 19.999 });

      expect(response.status).toBe(422);
      expect(bodyOf(response).code).toBe('MONEY_INVALID');
    });

    it('returns 422 for a malformed sku', async () => {
      const response = await create({ sku: 'a b' });

      expect(response.status).toBe(422);
      expect(bodyOf(response).code).toBe('PRODUCT_SKU_INVALID');
    });

    it('returns 422 for a currency that is not three letters', async () => {
      const response = await create({ currency: 'EURO' });

      expect(response.status).toBe(422);
      expect(bodyOf(response).code).toBe('MONEY_INVALID');
    });

    it('returns 409 for a duplicate sku, with the catch-all filter installed', async () => {
      await create();

      const response = await create({ name: 'Another Machine' });

      expect(response.status).toBe(409);
      expect(bodyOf(response).code).toBe('PRODUCT_SKU_DUPLICATE');
    });
  });

  describe('GET /products/:id', () => {
    it('returns the product with a decimal price', async () => {
      const created = await create();
      const id = bodyOf(created).id ?? '';

      const response = await get(`/products/${id}`);

      expect(response.status).toBe(200);
      expect(bodyOf(response)).toMatchObject({
        id,
        price: 249.99,
        currency: 'EUR',
        sku: 'ESP-001',
        stock: 12,
      });
      expect(typeof bodyOf(response).createdAt).toBe('string');
    });

    it('never exposes minor units to a client', async () => {
      const created = await create();

      const response = await get(`/products/${bodyOf(created).id ?? ''}`);

      expect(bodyOf(response).priceMinorUnits).toBeUndefined();
    });

    it('returns 400 for a malformed id', async () => {
      expect((await get('/products/nope')).status).toBe(400);
    });

    it('returns 404 when no product holds the id', async () => {
      const response = await get(`/products/${MISSING_ID}`);

      expect(response.status).toBe(404);
      expect(bodyOf(response).code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('GET /products', () => {
    const list = (query = ''): request.Test => get(`/products${query}`);

    it('returns a pagination envelope with defaults applied', async () => {
      await create({ sku: 'A-1' });

      const response = await list();

      expect(response.status).toBe(200);
      expect(bodyOf(response)).toMatchObject({
        total: 1,
        limit: 20,
        offset: 0,
      });
      expect(bodyOf(response).items).toHaveLength(1);
    });

    it('applies a zero minimum', async () => {
      await create({ sku: 'FREE', price: 0 });
      await create({ sku: 'PAID', price: 10 });

      expect(bodyOf(await list('?minPrice=0&currency=EUR')).total).toBe(2);
    });

    it('filters by a numeric bound', async () => {
      await create({ sku: 'CHEAP', price: 5 });
      await create({ sku: 'DEAR', price: 50 });

      const response = await list('?minPrice=10&currency=EUR');

      expect(bodyOf(response).items?.map((item) => item.sku)).toEqual(['DEAR']);
    });

    it('rejects a non-numeric bound at the edge, not in the domain', async () => {
      expect((await list('?minPrice=abc&currency=EUR')).status).toBe(400);
    });

    it('requires a currency when a price bound is given', async () => {
      expect((await list('?minPrice=10')).status).toBe(400);
    });

    it('rejects a negative bound', async () => {
      expect((await list('?minPrice=-1&currency=EUR')).status).toBe(400);
    });

    it('rejects a non-numeric limit', async () => {
      expect((await list('?limit=abc')).status).toBe(400);
    });

    it('rejects a limit above the maximum', async () => {
      expect((await list('?limit=101')).status).toBe(400);
    });

    it('rejects a limit of zero', async () => {
      expect((await list('?limit=0')).status).toBe(400);
    });

    it('rejects a negative offset', async () => {
      expect((await list('?offset=-1')).status).toBe(400);
    });

    it('honours limit and offset', async () => {
      await create({ sku: 'A-1' });
      await create({ sku: 'A-2' });
      await create({ sku: 'A-3' });

      const response = await list('?limit=2&offset=2');

      expect(bodyOf(response)).toMatchObject({ total: 3, limit: 2, offset: 2 });
      expect(bodyOf(response).items).toHaveLength(1);
    });

    it('reports the total past the end of the results', async () => {
      await create({ sku: 'A-1' });

      const response = await list('?limit=10&offset=50');

      expect(bodyOf(response)).toMatchObject({ total: 1, items: [] });
    });
  });

  describe('DELETE /products/:id', () => {
    const remove = (id: string): request.Test =>
      request(app.getHttpServer())
        .delete(`/products/${id}`)
        .set('Authorization', authHeader);

    it('returns 204 and removes the product', async () => {
      const created = await create();
      const id = bodyOf(created).id ?? '';

      expect((await remove(id)).status).toBe(204);
      expect((await get(`/products/${id}`)).status).toBe(404);
    });

    it('returns 400 for a malformed id', async () => {
      expect((await remove('nope')).status).toBe(400);
    });

    it('returns 404 when no product holds the id', async () => {
      const response = await remove(MISSING_ID);

      expect(response.status).toBe(404);
      expect(bodyOf(response).code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('PUT /products/:id', () => {
    const replacement = (
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      name: 'Espresso Machine II',
      description: 'Makes more espresso.',
      price: 199.5,
      sku: 'ESP-002',
      stock: 3,
      currency: 'EUR',
      ...overrides,
    });

    const put = (id: string, body: Record<string, unknown>): request.Test =>
      request(app.getHttpServer())
        .put(`/products/${id}`)
        .set('Authorization', authHeader)
        .send(body);

    const createdId = async (): Promise<string> =>
      bodyOf(await create()).id ?? '';

    it('returns 204 with no body and replaces every field', async () => {
      const id = await createdId();

      const response = await put(id, replacement({ currency: 'USD' }));

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(bodyOf(await get(`/products/${id}`))).toMatchObject({
        name: 'Espresso Machine II',
        price: 199.5,
        sku: 'ESP-002',
        stock: 3,
        currency: 'USD',
      });
    });

    it('returns 400 when currency is omitted, rather than resetting it to EUR', async () => {
      // Create defaults the currency; replace must not, or a PUT without it
      // would silently convert a product's currency.
      const id = await createdId();

      expect((await put(id, replacement({ currency: undefined }))).status).toBe(
        400,
      );
    });

    it('returns 400 when a required field is missing', async () => {
      const id = await createdId();

      expect((await put(id, replacement({ stock: undefined }))).status).toBe(
        400,
      );
    });

    it('returns 400 for an unknown property', async () => {
      const id = await createdId();

      expect((await put(id, replacement({ isAdmin: true }))).status).toBe(400);
    });

    it('returns 400 for a malformed id', async () => {
      expect((await put('nope', replacement())).status).toBe(400);
    });

    it('returns 404 when no product holds the id', async () => {
      const response = await put(MISSING_ID, replacement());

      expect(response.status).toBe(404);
      expect(bodyOf(response).code).toBe('PRODUCT_NOT_FOUND');
    });

    it('reports a broken invariant before a missing product', async () => {
      const response = await put(MISSING_ID, replacement({ name: 'a' }));

      expect(response.status).toBe(422);
      expect(bodyOf(response).code).toBe('PRODUCT_NAME_INVALID');
    });

    it('returns 409 when another product holds the sku', async () => {
      await create({ sku: 'TAKEN-1' });
      const id = bodyOf(await create({ sku: 'TARGET-1' })).id ?? '';

      const response = await put(id, replacement({ sku: 'TAKEN-1' }));

      expect(response.status).toBe(409);
      expect(bodyOf(response).code).toBe('PRODUCT_SKU_DUPLICATE');
    });

    it('accepts a replacement that keeps the product its own sku', async () => {
      const id = await createdId();

      expect((await put(id, replacement({ sku: 'ESP-001' }))).status).toBe(204);
    });
  });

  it('refuses a protected endpoint with no token', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send(validBody())
      .expect(401);
  });

  it('leaves the public endpoints reachable without a token', async () => {
    expect((await get('/products')).status).toBe(200);
  });
});
