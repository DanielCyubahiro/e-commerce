import { InvalidOrderStatusException, type Order } from '@/ordering/domain';
import { InMemoryOrderReadRepository } from '@test/fakes/in-memory-order-read.repository';
import { InMemoryOrderWriteRepository } from '@test/fakes/in-memory-order-write.repository';
import { seedPlaced } from '@test/fakes/seed-order';
import { catchRejection } from '@test/support/catch-error';
import { ListOrdersHandler } from './list-orders.handler';
import { ListOrdersQuery } from './list-orders.query';

const CUSTOMER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_CUSTOMER = '16fd2706-8baf-433b-82eb-8c7fada847da';
const page = { limit: 20, offset: 0 };

describe('ListOrdersHandler', () => {
  let writes: InMemoryOrderWriteRepository;
  let handler: ListOrdersHandler;
  let mine: Order;
  let theirs: Order;

  beforeEach(async () => {
    writes = new InMemoryOrderWriteRepository();
    handler = new ListOrdersHandler(new InMemoryOrderReadRepository(writes));
    mine = await seedPlaced(writes, CUSTOMER);
    theirs = await seedPlaced(writes, OTHER_CUSTOMER);
    const loaded = (await writes.findById(theirs.id)) as Order;
    loaded.pay(new Date());
    await writes.save(loaded);
  });

  it('scopes a customer to their own orders, whatever filter they sent', async () => {
    const result = await handler.execute(
      new ListOrdersQuery(
        { customerId: OTHER_CUSTOMER },
        { kind: 'customer', customerId: CUSTOMER },
        page,
      ),
    );

    expect(result.items.map((item) => item.id)).toEqual([mine.id.value]);
  });

  it('lets staff see everything and filter by customer', async () => {
    const everything = await handler.execute(
      new ListOrdersQuery({}, { kind: 'staff' }, page),
    );
    const filtered = await handler.execute(
      new ListOrdersQuery(
        { customerId: OTHER_CUSTOMER },
        { kind: 'staff' },
        page,
      ),
    );

    expect(everything.total).toBe(2);
    expect(filtered.items.map((item) => item.id)).toEqual([theirs.id.value]);
  });

  it('normalises the status filter before it reaches the port', async () => {
    const result = await handler.execute(
      new ListOrdersQuery({ status: ' PAID ' }, { kind: 'staff' }, page),
    );

    expect(result.items.map((item) => item.id)).toEqual([theirs.id.value]);
  });

  it('rejects an unknown status rather than returning an empty page', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new ListOrdersQuery({ status: 'refunded' }, { kind: 'staff' }, page),
        ),
      InvalidOrderStatusException,
    );

    expect(error.code).toBe('ORDER_STATUS_INVALID');
  });

  it('passes pagination straight through', async () => {
    const result = await handler.execute(
      new ListOrdersQuery({}, { kind: 'staff' }, { limit: 1, offset: 1 }),
    );

    expect(result).toMatchObject({ limit: 1, offset: 1, total: 2 });
    expect(result.items).toHaveLength(1);
  });
});
