import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  Password,
  PasswordAttempt,
  SessionId,
  UserId,
} from '@/identity/domain';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from '../../../ports/credential.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../ports/password-hasher';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../../ports/refresh-token.repository';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { ChangePasswordCommand } from './change-password.command';

/**
 * The current-password check and the session-sparing revocation below are the
 * security-relevant parts; see the class comment on the port for why reset,
 * the other write path to this same column, revokes differently.
 */
@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<
  ChangePasswordCommand,
  void
> {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const userId = UserId.create(command.userId);
    const attempt = PasswordAttempt.create(command.currentPassword);

    // The new password is validated before the current one is checked, so a
    // policy failure does not depend on getting the old password right.
    const newHash = await this.hasher.hash(
      Password.create(command.newPassword),
    );

    const stored = await this.credentials.findPasswordHash(userId);

    // A valid access token proves the caller holds a token, not that they are
    // the account owner. Requiring the current password is what stops a
    // stolen access token turning into permanent account takeover inside its
    // fifteen-minute window.
    const matches =
      stored !== null && (await this.hasher.verify(attempt, stored));

    if (!matches) {
      throw new InvalidCredentialsException();
    }

    const now = new Date();
    await this.credentials.changePassword(userId, newHash);

    // Every other session goes; this one stays, which is what a user expects
    // from changing their own password rather than recovering it.
    await this.refreshTokens.revokeAllForUser(
      userId,
      now,
      SessionId.create(command.sessionId),
    );
  }
}
