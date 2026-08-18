import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Page } from '@/shared/application';
import { UserRole } from '@/user/domain';
import {
  USER_READ_REPOSITORY,
  type UserFilters,
  type UserReadRepository,
} from '../../../ports/user.read-repository';
import type { UserReadModel } from '../../../read-models/user.read-model';
import { ListUsersQuery } from './list-users.query';

/**
 * Parsing the role filter through `UserRole` happens here because presentation
 * is forbidden from importing the domain and infrastructure has no reason to
 * know the closed set. It is also what turns `?role=selller` into a 422 rather
 * than an empty page that reads as "no sellers exist".
 */
@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<
  ListUsersQuery,
  Page<UserReadModel>
> {
  constructor(
    @Inject(USER_READ_REPOSITORY)
    private readonly userRepository: UserReadRepository,
  ) {}

  async execute(query: ListUsersQuery): Promise<Page<UserReadModel>> {
    return this.userRepository.findMany(
      ListUsersHandler.toStoredRole(query.filters),
      query.pagination,
    );
  }

  private static toStoredRole(filters: ListUsersQuery['filters']): UserFilters {
    const { role } = filters;

    return {
      role: role === undefined ? undefined : UserRole.create(role).value,
    };
  }
}
