import { catchRejection } from '@test/support/catch-error';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { DuplicateEmailException } from '../../../exceptions/duplicate-email.exception';
import { CreateUserCommand } from './create-user.command';
import { CreateUserHandler } from './create-user.handler';

describe('CreateUserHandler', () => {
  let repository: InMemoryUserWriteRepository;
  let handler: CreateUserHandler;

  const command = (email = 'ada@example.com'): CreateUserCommand =>
    new CreateUserCommand({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      role: 'seller',
    });

  beforeEach(() => {
    repository = new InMemoryUserWriteRepository();
    handler = new CreateUserHandler(repository);
  });

  it('stores the user and returns only its id', async () => {
    const id = await handler.execute(command());

    expect(repository.snapshot()).toHaveLength(1);
    expect(repository.snapshot()[0]?.id.value).toBe(id);
  });

  it('stores a user with no phone as null', async () => {
    await handler.execute(command());

    expect(repository.snapshot()[0]?.profile.phone).toBeNull();
  });

  it('lets a duplicate email surface from the port rather than pre-checking', async () => {
    await handler.execute(command());

    const error = await catchRejection(
      () => handler.execute(command()),
      DuplicateEmailException,
    );

    expect(error.code).toBe('USER_EMAIL_DUPLICATE');
  });
});
