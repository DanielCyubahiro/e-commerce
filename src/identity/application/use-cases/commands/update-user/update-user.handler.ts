import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UserId, UserProfile } from '@/identity/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import {
  USER_WRITE_REPOSITORY,
  type UserWriteRepository,
} from '../../../ports/user.write-repository';
import { UpdateUserCommand } from './update-user.command';

/**
 * Builds the replacement profile, which validates every field, then hands it
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
    // Built before the store is touched, so a request that breaks an invariant
    // answers 422 even when the id holds nothing.
    const profile = UserProfile.create(command.fields);

    const replaced = await this.userRepository.replaceProfile(
      UserId.create(command.id),
      profile,
    );

    if (!replaced) {
      throw new UserNotFoundException(command.id);
    }
  }
}
