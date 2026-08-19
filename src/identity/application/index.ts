export { DuplicateEmailException } from './exceptions/duplicate-email.exception';
export { EmailNotVerifiedException } from './exceptions/email-not-verified.exception';
export { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
export { InvalidVerificationTokenException } from './exceptions/invalid-verification-token.exception';
export { UserNotFoundException } from './exceptions/user-not-found.exception';
export {
  ACCESS_TOKEN_ISSUER,
  type AccessClaims,
  type AccessTokenIssuer,
  type IssuedAccessToken,
} from './ports/access-token.issuer';
export {
  CREDENTIAL_REPOSITORY,
  type AuthenticationRecord,
  type CredentialRepository,
} from './ports/credential.repository';
export { EMAIL_SENDER, type EmailSender } from './ports/email.sender';
export {
  ONE_TIME_TOKEN_REPOSITORY,
  type ConsumeOutcome,
  type IssuedOneTimeToken,
  type OneTimeTokenRepository,
} from './ports/one-time-token.repository';
export { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher';
export {
  REFRESH_TOKEN_REPOSITORY,
  type IssuedRefreshToken,
  type RefreshSuccessor,
  type RefreshTokenRepository,
  type RotationOutcome,
} from './ports/refresh-token.repository';
export {
  USER_READ_REPOSITORY,
  type UserFilters,
  type UserReadRepository,
} from './ports/user.read-repository';
export {
  USER_WRITE_REPOSITORY,
  type Registration,
  type UserWriteRepository,
} from './ports/user.write-repository';
export type { UserReadModel } from './read-models/user.read-model';
export {
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  refreshExpiry,
  resetExpiry,
  verificationExpiry,
} from './token-lifetimes';
export { DeleteUserCommand } from './use-cases/commands/delete-user/delete-user.command';
export { DeleteUserHandler } from './use-cases/commands/delete-user/delete-user.handler';
export { LoginCommand } from './use-cases/commands/login/login.command';
export {
  LoginHandler,
  type LoginResult,
} from './use-cases/commands/login/login.handler';
export { RegisterUserCommand } from './use-cases/commands/register-user/register-user.command';
export { RegisterUserHandler } from './use-cases/commands/register-user/register-user.handler';
export { ResendVerificationCommand } from './use-cases/commands/resend-verification/resend-verification.command';
export { ResendVerificationHandler } from './use-cases/commands/resend-verification/resend-verification.handler';
export { UpdateUserCommand } from './use-cases/commands/update-user/update-user.command';
export { UpdateUserHandler } from './use-cases/commands/update-user/update-user.handler';
export { VerifyEmailCommand } from './use-cases/commands/verify-email/verify-email.command';
export { VerifyEmailHandler } from './use-cases/commands/verify-email/verify-email.handler';
export { GetUserHandler } from './use-cases/queries/get-user/get-user.handler';
export { GetUserQuery } from './use-cases/queries/get-user/get-user.query';
export { ListUsersHandler } from './use-cases/queries/list-users/list-users.handler';
export {
  ListUsersQuery,
  type ListUsersFilters,
} from './use-cases/queries/list-users/list-users.query';

import { DeleteUserHandler as DeleteUser } from './use-cases/commands/delete-user/delete-user.handler';
import { LoginHandler as Login } from './use-cases/commands/login/login.handler';
import { RegisterUserHandler as RegisterUser } from './use-cases/commands/register-user/register-user.handler';
import { ResendVerificationHandler as ResendVerification } from './use-cases/commands/resend-verification/resend-verification.handler';
import { UpdateUserHandler as UpdateUser } from './use-cases/commands/update-user/update-user.handler';
import { VerifyEmailHandler as VerifyEmail } from './use-cases/commands/verify-email/verify-email.handler';
import { GetUserHandler as GetUser } from './use-cases/queries/get-user/get-user.handler';
import { ListUsersHandler as ListUsers } from './use-cases/queries/list-users/list-users.handler';

export const commandHandlers = [
  RegisterUser,
  DeleteUser,
  UpdateUser,
  VerifyEmail,
  ResendVerification,
  Login,
];
export const queryHandlers = [ListUsers, GetUser];
