import { catchRejection } from '@test/support/catch-error';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { InvalidUserRoleException, User, UserId } from '@/identity/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import { UpdateUserCommand } from './update-user.command';
import { UpdateUserHandler } from './update-user.handler';

describe('UpdateUserHandler', () => {
  let repository: InMemoryUserWriteRepository;
  let handler: UpdateUserHandler;

  const fields = {
    firstName: 'Grace',
    lastName: 'Hopper',
    role: 'customer',
  };

  beforeEach(() => {
    repository = new InMemoryUserWriteRepository();
    handler = new UpdateUserHandler(repository);
  });

  it('replaces every mutable field of an existing user', async () => {
    const stored = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
      phone: '+32489123456',
    });
    await repository.add(stored);

    await handler.execute(new UpdateUserCommand(stored.id.value, fields));

    const replaced = repository.snapshot()[0];
    expect(replaced?.profile.firstName).toBe('Grace');
    expect(replaced?.profile.role.value).toBe('customer');
    // An omitted phone clears it: PUT replaces, it never merges. See ADR 0008.
    expect(replaced?.profile.phone).toBeNull();
  });

  it('reports the user missing when no row holds the id', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(new UpdateUserCommand(UserId.create().value, fields)),
      UserNotFoundException,
    );

    expect(error.code).toBe('USER_NOT_FOUND');
  });

  it('rejects a broken invariant before it looks for the row', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new UpdateUserCommand(UserId.create().value, {
            ...fields,
            role: 'admin',
          }),
        ),
      InvalidUserRoleException,
    );

    // 422 rather than 404: the profile is built before the store is touched.
    expect(error.code).toBe('USER_ROLE_INVALID');
  });
});
