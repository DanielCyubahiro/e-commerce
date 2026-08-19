export { DuplicateEmailException } from './exceptions/duplicate-email.exception';
export { EmailNotVerifiedException } from './exceptions/email-not-verified.exception';
export { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
export { InvalidRefreshTokenException } from './exceptions/invalid-refresh-token.exception';
export { InvalidResetTokenException } from './exceptions/invalid-reset-token.exception';
export { InvalidVerificationTokenException } from './exceptions/invalid-verification-token.exception';
export { UnauthenticatedException } from './exceptions/unauthenticated.exception';
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
export { ChangePasswordCommand } from './use-cases/commands/change-password/change-password.command';
export { ChangePasswordHandler } from './use-cases/commands/change-password/change-password.handler';
export { DeleteUserCommand } from './use-cases/commands/delete-user/delete-user.command';
export { DeleteUserHandler } from './use-cases/commands/delete-user/delete-user.handler';
export { LoginCommand } from './use-cases/commands/login/login.command';
export {
  LoginHandler,
  type LoginResult,
} from './use-cases/commands/login/login.handler';
export { LogoutAllSessionsCommand } from './use-cases/commands/logout-all-sessions/logout-all-sessions.command';
export { LogoutAllSessionsHandler } from './use-cases/commands/logout-all-sessions/logout-all-sessions.handler';
export { LogoutCommand } from './use-cases/commands/logout/logout.command';
export { LogoutHandler } from './use-cases/commands/logout/logout.handler';
export { RefreshSessionCommand } from './use-cases/commands/refresh-session/refresh-session.command';
export { RefreshSessionHandler } from './use-cases/commands/refresh-session/refresh-session.handler';
export { RegisterUserCommand } from './use-cases/commands/register-user/register-user.command';
export { RegisterUserHandler } from './use-cases/commands/register-user/register-user.handler';
export { RequestPasswordResetCommand } from './use-cases/commands/request-password-reset/request-password-reset.command';
export { RequestPasswordResetHandler } from './use-cases/commands/request-password-reset/request-password-reset.handler';
export { ResendVerificationCommand } from './use-cases/commands/resend-verification/resend-verification.command';
export { ResendVerificationHandler } from './use-cases/commands/resend-verification/resend-verification.handler';
export { ResetPasswordCommand } from './use-cases/commands/reset-password/reset-password.command';
export { ResetPasswordHandler } from './use-cases/commands/reset-password/reset-password.handler';
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

import { ChangePasswordHandler as ChangePassword } from './use-cases/commands/change-password/change-password.handler';
import { DeleteUserHandler as DeleteUser } from './use-cases/commands/delete-user/delete-user.handler';
import { LoginHandler as Login } from './use-cases/commands/login/login.handler';
import { LogoutAllSessionsHandler as LogoutAllSessions } from './use-cases/commands/logout-all-sessions/logout-all-sessions.handler';
import { LogoutHandler as Logout } from './use-cases/commands/logout/logout.handler';
import { RefreshSessionHandler as RefreshSession } from './use-cases/commands/refresh-session/refresh-session.handler';
import { RegisterUserHandler as RegisterUser } from './use-cases/commands/register-user/register-user.handler';
import { RequestPasswordResetHandler as RequestPasswordReset } from './use-cases/commands/request-password-reset/request-password-reset.handler';
import { ResendVerificationHandler as ResendVerification } from './use-cases/commands/resend-verification/resend-verification.handler';
import { ResetPasswordHandler as ResetPassword } from './use-cases/commands/reset-password/reset-password.handler';
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
  RefreshSession,
  Logout,
  LogoutAllSessions,
  RequestPasswordReset,
  ResetPassword,
  ChangePassword,
];
export const queryHandlers = [ListUsers, GetUser];
