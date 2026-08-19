import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { User } from '@/identity/domain';
import {
  USER_WRITE_REPOSITORY,
  type UserWriteRepository,
} from '../../../ports/user.write-repository';
import { CreateUserCommand } from './create-user.command';

/**
 * Constructs the aggregate, which validates every field, then delegates email
 * uniqueness to `UserWriteRepository.add`. No read-then-write check happens
 * here; the store is the sole arbiter of uniqueness.
 */
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<
  CreateUserCommand,
  string
> {
  constructor(
    @Inject(USER_WRITE_REPOSITORY)
    private readonly userRepository: UserWriteRepository,
  ) {}

  /** @returns the new user's id */
  async execute(command: CreateUserCommand): Promise<string> {
    const user = User.create(command.fields);

    await this.userRepository.add(user);

    return user.id.value;
  }
}
