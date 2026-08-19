export { DuplicateEmailException } from './exceptions/duplicate-email.exception';
export { UserNotFoundException } from './exceptions/user-not-found.exception';
export {
  ACCESS_TOKEN_ISSUER,
  type AccessClaims,
  type AccessTokenIssuer,
  type IssuedAccessToken,
} from './ports/access-token.issuer';
export { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher';
export {
  USER_READ_REPOSITORY,
  type UserFilters,
  type UserReadRepository,
} from './ports/user.read-repository';
export {
  USER_WRITE_REPOSITORY,
  type UserWriteRepository,
} from './ports/user.write-repository';
export type { UserReadModel } from './read-models/user.read-model';
export { CreateUserCommand } from './use-cases/commands/create-user/create-user.command';
export { CreateUserHandler } from './use-cases/commands/create-user/create-user.handler';
export { DeleteUserCommand } from './use-cases/commands/delete-user/delete-user.command';
export { DeleteUserHandler } from './use-cases/commands/delete-user/delete-user.handler';
export { UpdateUserCommand } from './use-cases/commands/update-user/update-user.command';
export { UpdateUserHandler } from './use-cases/commands/update-user/update-user.handler';
export { GetUserHandler } from './use-cases/queries/get-user/get-user.handler';
export { GetUserQuery } from './use-cases/queries/get-user/get-user.query';
export { ListUsersHandler } from './use-cases/queries/list-users/list-users.handler';
export {
  ListUsersQuery,
  type ListUsersFilters,
} from './use-cases/queries/list-users/list-users.query';

import { CreateUserHandler as CreateUser } from './use-cases/commands/create-user/create-user.handler';
import { DeleteUserHandler as DeleteUser } from './use-cases/commands/delete-user/delete-user.handler';
import { UpdateUserHandler as UpdateUser } from './use-cases/commands/update-user/update-user.handler';
import { GetUserHandler as GetUser } from './use-cases/queries/get-user/get-user.handler';
import { ListUsersHandler as ListUsers } from './use-cases/queries/list-users/list-users.handler';

export const commandHandlers = [CreateUser, DeleteUser, UpdateUser];
export const queryHandlers = [ListUsers, GetUser];
