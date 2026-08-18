import { catchRejection } from '@test/support/catch-error';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { User, UserId } from '@/user/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import { DeleteUserCommand } from './delete-user.command';
import { DeleteUserHandler } from './delete-user.handler';

describe('DeleteUserHandler', () => {
  let repository: InMemoryUserWriteRepository;
  let handler: DeleteUserHandler;

  beforeEach(() => {
    repository = new InMemoryUserWriteRepository();
    handler = new DeleteUserHandler(repository);
  });

  it('removes the row', async () => {
    const user = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
    });
    await repository.add(user);

    await handler.execute(new DeleteUserCommand(user.id.value));

    expect(repository.snapshot()).toHaveLength(0);
  });

  it('reports the user missing when nothing was removed', async () => {
    const error = await catchRejection(
      () => handler.execute(new DeleteUserCommand(UserId.create().value)),
      UserNotFoundException,
    );

    expect(error.code).toBe('USER_NOT_FOUND');
  });
});
