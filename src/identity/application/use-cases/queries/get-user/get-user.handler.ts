import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserId } from '@/identity/domain';
import { UserNotFoundException } from '../../../exceptions/user-not-found.exception';
import {
  USER_READ_REPOSITORY,
  type UserReadRepository,
} from '../../../ports/user.read-repository';
import type { UserReadModel } from '../../../read-models/user.read-model';
import { GetUserQuery } from './get-user.query';

/** Never rehydrates the aggregate: the port answers with a read model. */
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<
  GetUserQuery,
  UserReadModel
> {
  constructor(
    @Inject(USER_READ_REPOSITORY)
    private readonly userRepository: UserReadRepository,
  ) {}

  async execute(query: GetUserQuery): Promise<UserReadModel> {
    const user = await this.userRepository.findById(
      UserId.create(query.userId),
    );

    if (!user) {
      throw new UserNotFoundException(query.userId);
    }

    return user;
  }
}
