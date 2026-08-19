import { catchRejection } from '@test/support/catch-error';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { InvalidUserRoleException, User } from '@/identity/domain';
import { ListUsersQuery } from './list-users.query';
import { ListUsersHandler } from './list-users.handler';

describe('ListUsersHandler', () => {
  let writes: InMemoryUserWriteRepository;
  let handler: ListUsersHandler;

  const pagination = { limit: 20, offset: 0 };

  beforeEach(async () => {
    writes = new InMemoryUserWriteRepository();
    handler = new ListUsersHandler(new InMemoryUserReadRepository(writes));
    await writes.add(
      User.create({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'seller',
      }),
    );
    await writes.add(
      User.create({
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        role: 'customer',
      }),
    );
  });

  it('returns every user when no role is given', async () => {
    const page = await handler.execute(new ListUsersQuery({}, pagination));

    expect(page.total).toBe(2);
  });

  it('normalises the role filter before it reaches the port', async () => {
    const page = await handler.execute(
      new ListUsersQuery({ role: 'SELLER' }, pagination),
    );

    expect(page.items.map((item) => item.email)).toEqual(['ada@example.com']);
  });

  it('rejects an unknown role rather than returning an empty page', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(new ListUsersQuery({ role: 'selller' }, pagination)),
      InvalidUserRoleException,
    );

    expect(error.code).toBe('USER_ROLE_INVALID');
  });
});
