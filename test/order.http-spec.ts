import { Global, type INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '@/app.config';
import {
  PRODUCT_READ_REPOSITORY,
  PRODUCT_WRITE_REPOSITORY,
  STOCK_ALLOCATOR,
} from '@/catalogue/application';
import {
  AuthenticateSessionHandler,
  SESSION_REPOSITORY,
} from '@/identity/application';
import {
  AUTH_WEB_SETTINGS,
  authWebSettingsFrom,
} from '@/identity/presentation/auth-web-settings';
import { SessionAuthGuard } from '@/identity/presentation/guards/session-auth.guard';
import { SessionCookie } from '@/identity/presentation/session-cookie';
import {
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@/ordering/application';
import { OrderingModule } from '@/ordering/ordering.module';
import { UNIT_OF_WORK } from '@/shared/application';
import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { InMemoryOrderReadRepository } from '@test/fakes/in-memory-order-read.repository';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { InMemoryProductReadRepository } from '@test/fakes/in-memory-product-read.repository';
import { InMemoryProductWriteRepository } from '@test/fakes/in-memory-product-write.repository';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import { InMemoryStockAllocator } from '@test/fakes/in-memory-stock-allocator';
import { seedSessionCookie } from '@test/support/session-cookie';

const CUSTOMER_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const CUSTOMER_B = '16fd2706-8baf-433b-82eb-8c7fada847da';
const SELLER = '9c858901-8a57-4791-81fe-4c455b099bc9';
const MISSING_ID = '00000000-0000-4000-8000-0000000000aa';
const KEY = '00000000-0000-4000-8000-0000000000bb';
const ALLOWED_ORIGIN = 'http://localhost:5173';

// Only the session lifetimes matter here; the fake's `touch` reads them.
const lifetimes = {
  passwordResetMinutes: 60,
  emailVerificationHours: 24,
  sessionIdleDays: 30,
  sessionAbsoluteDays: 365,
};

interface ResponseBody {
  id?: string;
  code?: string;
  number?: string;
  status?: string;
  total?: number;
  subtotal?: number;
  shippingFee?: number;
  tax?: number;
  lineCount?: number;
  lines?: { sku: string; unitPrice: number; lineTotal: number }[];
  shippingAddress?: { country: string; line2: string | null };
  details?: { productId: string; reason: string; available: number | null }[];
  items?: { id: string; status: string }[];
  limit?: number;
  offset?: number;
  stock?: number;
}

const bodyOf = (response: request.Response): ResponseBody =>
  response.body as ResponseBody;

describe('orders HTTP contract', () => {
  let app: INestApplication<App>;
  let customerA: string;
  let customerB: string;
  let seller: string;
  let espressoId: string;
  let kettleId: string;

  beforeEach(async () => {
    const sessions = new InMemorySessionRepository(lifetimes);
    const seed = async (userId: string, role: string): Promise<string> =>
      (await seedSessionCookie(sessions, { userId, role })).cookie;
    customerA = await seed(CUSTOMER_A, 'customer');
    customerB = await seed(CUSTOMER_B, 'customer');
    seller = await seed(SELLER, 'seller');

    const products = new InMemoryProductWriteRepository();
    const orders = new InMemoryOrderWriteRepository();
    const uow = new FakeUnitOfWork([products, orders]);

    // DrizzleModule normally provides UNIT_OF_WORK globally; this suite boots
    // without it, so a throwaway global module stands in.
    @Global()
    @Module({
      providers: [{ provide: UNIT_OF_WORK, useValue: uow }],
      exports: [UNIT_OF_WORK],
    })
    class FakeUnitOfWorkModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [FakeUnitOfWorkModule, OrderingModule, CqrsModule],
      // OrderingModule carries no guard of its own, so the session guard is
      // wired by hand with everything it resolves, as product.http-spec does.
      providers: [
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: SESSION_REPOSITORY, useValue: sessions },
        {
          provide: AUTH_WEB_SETTINGS,
          useValue: authWebSettingsFrom(ALLOWED_ORIGIN, lifetimes),
        },
        SessionCookie,
        AuthenticateSessionHandler,
      ],
    })
      .overrideProvider(PRODUCT_WRITE_REPOSITORY)
      .useValue(products)
      .overrideProvider(PRODUCT_READ_REPOSITORY)
      .useValue(new InMemoryProductReadRepository(products))
      .overrideProvider(STOCK_ALLOCATOR)
      .useValue(new InMemoryStockAllocator(products))
      .overrideProvider(ORDER_WRITE_REPOSITORY)
      .useValue(orders)
      .overrideProvider(ORDER_READ_REPOSITORY)
      .useValue(new InMemoryOrderReadRepository(orders))
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
      { allowedOrigin: ALLOWED_ORIGIN },
    );
    await app.listen(0);

    // Seeded through the catalogue's own endpoint, since OrderingModule
    // imports CatalogueModule and its controller comes along.
    espressoId = await createProduct({
      sku: 'ESP-001',
      price: 249.99,
      stock: 12,
    });
    kettleId = await createProduct({ sku: 'KET-1', price: 10, stock: 3 });
  });

  afterEach(async () => {
    await app.close();
  });

  const createProduct = async (over: {
    sku: string;
    price: number;
    stock: number;
  }): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', seller)
      .send({
        name: `Product ${over.sku}`,
        description: 'Seeded.',
        currency: 'EUR',
        ...over,
      })
      .expect(201);
    return bodyOf(response).id ?? '';
  };

  const stockOf = async (productId: string): Promise<number | undefined> =>
    bodyOf(await request(app.getHttpServer()).get(`/products/${productId}`))
      .stock;

  const orderBody = (
    lines: { productId: string; quantity: number }[] = [
      { productId: espressoId, quantity: 2 },
      { productId: kettleId, quantity: 1 },
    ],
  ): Record<string, unknown> => ({
    lines,
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Analytical Way',
      city: 'London',
      postalCode: 'N1 1AA',
      country: 'gb',
    },
  });

  const place = (
    cookie: string,
    body: Record<string, unknown> = orderBody(),
    key?: string,
  ): request.Test => {
    const req = request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', cookie);
    return (key ? req.set('Idempotency-Key', key) : req).send(body);
  };

  const placed = async (cookie = customerA): Promise<string> =>
    bodyOf(await place(cookie).expect(201)).id ?? '';

  const act = (cookie: string, id: string, action: string): request.Test =>
    request(app.getHttpServer())
      .post(`/orders/${id}/${action}`)
      .set('Cookie', cookie);

  const get = (cookie: string, path: string): request.Test =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie);

  describe('POST /orders', () => {
    it('returns 401 without a cookie', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send(orderBody())
        .expect(401);
    });

    it('returns 201 with the id and a Location header, and allocates stock', async () => {
      const response = await place(customerA).expect(201);

      expect(bodyOf(response).id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers.location).toBe(
        `/orders/${bodyOf(response).id ?? ''}`,
      );
      expect(await stockOf(espressoId)).toBe(10);
      expect(await stockOf(kettleId)).toBe(2);
    });

    it('replays an Idempotency-Key with the same 201, id, and Location', async () => {
      const first = await place(customerA, orderBody(), KEY).expect(201);
      const second = await place(customerA, orderBody(), KEY).expect(201);

      expect(bodyOf(second).id).toBe(bodyOf(first).id);
      expect(second.headers.location).toBe(first.headers.location);
      expect(await stockOf(espressoId)).toBe(10);
    });

    it('returns 400 for a malformed Idempotency-Key', async () => {
      const response = await place(customerA, orderBody(), 'not-a-uuid');

      expect(response.status).toBe(400);
    });

    it('returns 400 when a required field is missing', async () => {
      const body = orderBody();
      delete body.shippingAddress;

      expect((await place(customerA, body)).status).toBe(400);
    });

    it('returns 400 for a fractional quantity at the edge', async () => {
      const response = await place(
        customerA,
        orderBody([{ productId: espressoId, quantity: 1.5 }]),
      );

      expect(response.status).toBe(400);
    });

    it('returns 400 for an unknown property', async () => {
      const response = await place(customerA, {
        ...orderBody(),
        coupon: 'FREE',
      });

      expect(response.status).toBe(400);
    });

    it('returns 422 with a typed code when the domain rejects a quantity', async () => {
      const response = await place(
        customerA,
        orderBody([{ productId: espressoId, quantity: 0 }]),
      ).expect(422);

      expect(bodyOf(response).code).toBe('ORDER_QUANTITY_INVALID');
    });

    it('returns 422 for a three-letter country', async () => {
      const body = orderBody();
      body.shippingAddress = {
        ...(body.shippingAddress as object),
        country: 'GBR',
      };

      const response = await place(customerA, body).expect(422);

      expect(bodyOf(response).code).toBe('ORDER_SHIPPING_ADDRESS_INVALID');
    });

    it('returns 409 with details for a shortfall, leaving stock untouched', async () => {
      const response = await place(
        customerA,
        orderBody([
          { productId: espressoId, quantity: 1 },
          { productId: kettleId, quantity: 4 },
        ]),
      ).expect(409);

      expect(bodyOf(response).code).toBe('ORDER_STOCK_UNAVAILABLE');
      expect(bodyOf(response).details).toEqual([
        { productId: kettleId, reason: 'insufficient', available: 3 },
      ]);
      expect(await stockOf(espressoId)).toBe(12);
    });

    it('reports an unknown product as a shortfall', async () => {
      const response = await place(
        customerA,
        orderBody([{ productId: MISSING_ID, quantity: 1 }]),
      ).expect(409);

      expect(bodyOf(response).details?.[0]?.reason).toBe('unknown');
    });

    it('returns 422 for the same product on two lines, leaving stock untouched', async () => {
      const response = await place(
        customerA,
        orderBody([
          { productId: espressoId, quantity: 1 },
          { productId: espressoId, quantity: 1 },
        ]),
      ).expect(422);

      expect(bodyOf(response).code).toBe('ORDER_LINES_INVALID');
      expect(await stockOf(espressoId)).toBe(12);
    });
  });

  describe('GET /orders/:id', () => {
    it('returns the detail with decimal prices, a formatted number, and the address', async () => {
      const id = await placed();

      const response = await get(customerA, `/orders/${id}`).expect(200);

      expect(bodyOf(response)).toMatchObject({
        id,
        number: 'ORD-000001',
        status: 'placed',
        subtotal: 509.98,
        shippingFee: 0,
        tax: 0,
        total: 509.98,
        lineCount: 2,
        shippingAddress: { country: 'GB', line2: null },
      });
      expect(
        bodyOf(response)
          .lines?.map((line) => line.sku)
          .sort(),
      ).toEqual(['ESP-001', 'KET-1']);
    });

    it('returns 404 to another customer', async () => {
      const id = await placed(customerA);

      const response = await get(customerB, `/orders/${id}`).expect(404);

      expect(bodyOf(response).code).toBe('ORDER_NOT_FOUND');
    });

    it('returns 200 to staff for any order', async () => {
      const id = await placed(customerA);

      expect((await get(seller, `/orders/${id}`)).status).toBe(200);
    });

    it('returns 400 for a malformed id and 404 for a missing one', async () => {
      expect((await get(customerA, '/orders/nope')).status).toBe(400);
      expect((await get(customerA, `/orders/${MISSING_ID}`)).status).toBe(404);
    });
  });

  describe('GET /orders', () => {
    it("lists only the caller's orders for a customer, newest first", async () => {
      await placed(customerB);
      const mine = await placed(customerA);

      const response = await get(customerA, '/orders').expect(200);

      expect(bodyOf(response).items?.map((item) => item.id)).toEqual([mine]);
      expect(bodyOf(response)).toMatchObject({ limit: 20, offset: 0 });
    });

    it('ignores a customerId filter under customer scope', async () => {
      await placed(customerB);
      const mine = await placed(customerA);

      const response = await get(
        customerA,
        `/orders?customerId=${CUSTOMER_B}`,
      ).expect(200);

      expect(bodyOf(response).items?.map((item) => item.id)).toEqual([mine]);
    });

    it('lists every order for staff, filterable by customer and status', async () => {
      const b = await placed(customerB);
      const a = await placed(customerA);
      await act(seller, a, 'pay').expect(204);

      const all = await get(seller, '/orders').expect(200);
      const onlyB = await get(
        seller,
        `/orders?customerId=${CUSTOMER_B}`,
      ).expect(200);
      const onlyPaid = await get(seller, '/orders?status=paid').expect(200);

      expect(bodyOf(all).items).toHaveLength(2);
      expect(bodyOf(onlyB).items?.map((item) => item.id)).toEqual([b]);
      expect(bodyOf(onlyPaid).items?.map((item) => item.id)).toEqual([a]);
    });

    it('answers 422 for an unknown status and 400 for a bad limit', async () => {
      expect(
        bodyOf(await get(seller, '/orders?status=refunded').expect(422)).code,
      ).toBe('ORDER_STATUS_INVALID');
      await get(seller, '/orders?limit=0').expect(400);
    });
  });

  describe('transitions', () => {
    it('pay, ship, deliver each answer 204 for staff and move the status', async () => {
      const id = await placed();

      await act(seller, id, 'pay').expect(204);
      await act(seller, id, 'ship').expect(204);
      await act(seller, id, 'deliver').expect(204);

      expect(bodyOf(await get(seller, `/orders/${id}`)).status).toBe(
        'delivered',
      );
    });

    it.each(['pay', 'ship', 'deliver'])(
      'returns 403 to a customer on %s, with the role code',
      async (action) => {
        const id = await placed();

        const response = await act(customerA, id, action).expect(403);

        expect(bodyOf(response).code).toBe('AUTH_ROLE_FORBIDDEN');
      },
    );

    it('returns 409 for an illegal move', async () => {
      const id = await placed();

      const response = await act(seller, id, 'ship').expect(409);

      expect(bodyOf(response).code).toBe('ORDER_TRANSITION_ILLEGAL');
    });

    it('returns 404 for an id nothing holds', async () => {
      expect((await act(seller, MISSING_ID, 'pay')).status).toBe(404);
    });
  });

  describe('POST /orders/:id/cancel', () => {
    it('lets the owner cancel and releases the stock', async () => {
      const id = await placed(customerA);

      await act(customerA, id, 'cancel').expect(204);

      expect(bodyOf(await get(customerA, `/orders/${id}`)).status).toBe(
        'cancelled',
      );
      expect(await stockOf(espressoId)).toBe(12);
    });

    it('returns 404 to another customer', async () => {
      const id = await placed(customerA);

      expect((await act(customerB, id, 'cancel')).status).toBe(404);
    });

    it('lets staff cancel any order', async () => {
      const id = await placed(customerA);

      expect((await act(seller, id, 'cancel')).status).toBe(204);
    });

    it('returns 409 once shipped', async () => {
      const id = await placed(customerA);
      await act(seller, id, 'pay').expect(204);
      await act(seller, id, 'ship').expect(204);

      expect(bodyOf(await act(customerA, id, 'cancel').expect(409)).code).toBe(
        'ORDER_TRANSITION_ILLEGAL',
      );
    });
  });
});
