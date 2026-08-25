import { catchRejection } from '@test/support/catch-error';
import { InMemoryUserReadRepository } from '@test/fakes/in-memory-user-read.repository';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { User, UserId } from '@/identity/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import { GetUserQuery } from './get-user.query';
import { GetUserHandler } from './get-user.handler';

describe('GetUserHandler', () => {
  let writes: InMemoryUserWriteRepository;
  let handler: GetUserHandler;

  beforeEach(() => {
    writes = new InMemoryUserWriteRepository();
    handler = new GetUserHandler(new InMemoryUserReadRepository(writes));
  });

  it('returns the read model for a stored user', async () => {
    const user = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    writes.seed(user);

    const found = await handler.execute(new GetUserQuery(user.id.value));

    expect(found.email).toBe('ada@example.com');
    expect(found.phone).toBeNull();
  });

  it('turns a null from the port into a not-found exception', async () => {
    const error = await catchRejection(
      () => handler.execute(new GetUserQuery(UserId.create().value)),
      UserNotFoundException,
    );

    expect(error.code).toBe('USER_NOT_FOUND');
  });
});
