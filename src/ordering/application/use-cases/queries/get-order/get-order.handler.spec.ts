import { InvalidIdentifierException } from '@/shared/domain';
import { InMemoryOrderReadRepository } from '@test/fakes/in-memory-order-read.repository';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { seedPlaced } from '@test/fakes/seed-order';
import { catchRejection } from '@test/support/catch-error';
import { OrderNotFoundException } from '../../../exceptions/order-not-found.exception';
import { GetOrderHandler } from './get-order.handler';
import { GetOrderQuery } from './get-order.query';

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_CUSTOMER = '16fd2706-8baf-433b-82eb-8c7fada847da';

describe('GetOrderHandler', () => {
  let writes: InMemoryOrderWriteRepository;
  let handler: GetOrderHandler;
  let orderId: string;

  beforeEach(async () => {
    writes = new InMemoryOrderWriteRepository();
    handler = new GetOrderHandler(new InMemoryOrderReadRepository(writes));
    orderId = (await seedPlaced(writes)).id.value;
  });

  it('returns the owner their order with its lines', async () => {
    const found = await handler.execute(
      new GetOrderQuery(orderId, { kind: 'customer', customerId: CUSTOMER }),
    );

    expect(found.id).toBe(orderId);
    expect(found.lines).toHaveLength(1);
  });

  it("hides another customer's order behind not-found", async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new GetOrderQuery(orderId, {
            kind: 'customer',
            customerId: OTHER_CUSTOMER,
          }),
        ),
      OrderNotFoundException,
    );

    expect(error.code).toBe('ORDER_NOT_FOUND');
  });

  it('shows staff any order', async () => {
    expect(
      (await handler.execute(new GetOrderQuery(orderId, { kind: 'staff' }))).id,
    ).toBe(orderId);
  });

  it('answers not-found for an id nothing holds', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new GetOrderQuery('9c858901-8a57-4791-81fe-4c455b099bc9', {
            kind: 'staff',
          }),
        ),
      OrderNotFoundException,
    );

    expect(error.code).toBe('ORDER_NOT_FOUND');
  });

  it('rejects a malformed id before reaching the repository', async () => {
    const error = await catchRejection(
      () => handler.execute(new GetOrderQuery('nope', { kind: 'staff' })),
      InvalidIdentifierException,
    );

    expect(error.code).toBe('IDENTIFIER_INVALID');
  });
});
