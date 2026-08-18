import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { User, UserId } from '@/user/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import {
  USER_WRITE_REPOSITORY,
  type UserWriteRepository,
} from '../../../ports/user.write-repository';
import { UpdateUserCommand } from './update-user.command';

/**
 * Builds the replacement aggregate, which validates every field, then hands it
 * to the port. Construction happens before the store is touched, so an invalid
 * payload aimed at an id that holds nothing surfaces as the invariant failure,
 * not as a missing user.
 */
@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<
  UpdateUserCommand,
  void
> {
  constructor(
    @Inject(USER_WRITE_REPOSITORY)
    private readonly userRepository: UserWriteRepository,
  ) {}

  async execute(command: UpdateUserCommand): Promise<void> {
    const user = User.replace(UserId.create(command.userId), command.fields);

    const replaced = await this.userRepository.replace(user);

    if (!replaced) {
      throw new UserNotFoundException(command.userId);
    }
  }
}
