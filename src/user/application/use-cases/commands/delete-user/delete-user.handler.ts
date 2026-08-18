import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UserId } from '@/user/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import {
  USER_WRITE_REPOSITORY,
  type UserWriteRepository,
} from '../../../ports/user.write-repository';
import { DeleteUserCommand } from './delete-user.command';

/**
 * The port returns false rather than throwing when no row held that id;
 * turning that into `UserNotFoundException` happens here.
 */
@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<
  DeleteUserCommand,
  void
> {
  constructor(
    @Inject(USER_WRITE_REPOSITORY)
    private readonly userRepository: UserWriteRepository,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const deleted = await this.userRepository.delete(
      UserId.create(command.userId),
    );

    if (!deleted) {
      throw new UserNotFoundException(command.userId);
    }
  }
}
